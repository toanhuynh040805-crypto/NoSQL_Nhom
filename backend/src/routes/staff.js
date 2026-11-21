import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { redis } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { DiningTable } from '../models/DiningTable.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { Reservation } from '../models/Reservation.js';
import { TableSession } from '../models/TableSession.js';
import { User } from '../models/User.js';
import { notifyRoles } from '../services/notifications.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'staff', 'cashier'));

const lockKey = sessionId => 'table:lock:' + sessionId;
const lockSeconds = 300;
const validId = id => {
  if (!isValidObjectId(id)) throw new AppError(400, 'Mã dữ liệu không hợp lệ');
  return id;
};
const activeReservationFilter = () => ({
  status: 'confirmed', reservedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
});

async function getLock(sessionId) {
  const ownerId = await redis.get(lockKey(sessionId));
  if (!ownerId) return null;
  const [owner, ttl] = await Promise.all([
    User.findById(ownerId).select('fullName').lean(),
    redis.ttl(lockKey(sessionId))
  ]);
  return { ownerId, ownerName: owner?.fullName || 'Nhân viên khác', secondsLeft: Math.max(0, ttl) };
}

async function getActiveSession(id) {
  const session = await TableSession.findOne({ _id: validId(id), status: 'active' })
    .populate('openedBy', 'fullName').populate('reservation', 'reservationCode');
  if (!session) throw new AppError(404, 'Phiên bàn đã kết thúc hoặc không tồn tại');
  return session;
}

router.get('/tables', asyncHandler(async (_req, res) => {
  const [tables, sessions, reservations] = await Promise.all([
    DiningTable.find({ status: { $ne: 'inactive' } }).sort({ area: 1, name: 1 }).lean(),
    TableSession.find({ status: 'active' }).select('table tableNumber guestCount customerName openedBy openedAt createdAt').lean(),
    Reservation.find(activeReservationFilter()).sort({ reservedAt: 1 }).select('table reservationCode reservedAt guestCount customerName').lean()
  ]);
  const sessionByTable = new Map(sessions.map(session => [String(session.table), session]));
  const reservationByTable = new Map();
  for (const item of reservations) {
    const key = String(item.table || '');
    if (key && !reservationByTable.has(key)) reservationByTable.set(key, item);
  }
  res.json({
    tables: tables.map(table => ({
      ...table,
      activeSession: sessionByTable.get(String(table._id)) || null,
      nextReservation: reservationByTable.get(String(table._id)) || null
    }))
  });
}));

router.get('/sessions/:id', asyncHandler(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  const [orders, lock] = await Promise.all([
    Order.find({ tableSession: session._id }).sort({ createdAt: 1 }).lean(),
    getLock(String(session._id))
  ]);
  res.json({
    session, orders, lock,
    subtotal: orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.totalAmount, 0),
    unpaid: orders.filter(o => o.status !== 'cancelled' && o.paymentStatus !== 'paid').length
  });
}));

router.post('/tables/:id/open', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const body = z.object({
    guestCount: z.coerce.number().int().min(1).max(50),
    customerName: z.string().trim().max(100).default(''),
    reservationId: z.string().optional()
  }).parse(req.body);
  const table = await DiningTable.findById(validId(req.params.id));
  if (!table || !['available', 'reserved'].includes(table.status)) {
    throw new AppError(409, 'Bàn không trống hoặc đã có phiên phục vụ');
  }
  if (body.guestCount > table.capacity) throw new AppError(400, 'Số khách vượt sức chứa bàn');

  let reservation = null;
  if (table.status === 'reserved') {
    if (!body.reservationId) throw new AppError(409, 'Bàn đang được đặt trước, hãy nhận đúng lịch đặt bàn');
    reservation = await Reservation.findOne({
      _id: validId(body.reservationId), table: table._id, ...activeReservationFilter()
    });
    if (!reservation) throw new AppError(409, 'Lịch đặt bàn chưa được xác nhận hoặc không đúng bàn');
    if (body.guestCount !== reservation.guestCount) throw new AppError(409, 'Số khách không khớp lịch đặt bàn');
  } else if (body.reservationId) {
    throw new AppError(400, 'Bàn trống không yêu cầu mã đặt bàn');
  }

  // Conditional update ensures two waiters cannot both receive an available table.
  const claimed = await DiningTable.findOneAndUpdate(
    { _id: table._id, status: table.status }, { $set: { status: 'occupied' } }, { new: true }
  );
  if (!claimed) throw new AppError(409, 'Bàn vừa được nhân viên khác nhận. Vui lòng tải lại');

  let session;
  try {
    session = await TableSession.create({
      table: table._id, tableNumber: table.name, guestCount: body.guestCount,
      customerName: body.customerName || reservation?.customerName || '',
      reservation: reservation?._id, openedBy: req.user._id,
      activity: [{ action: 'open', by: req.user._id, detail: reservation ? 'Nhận bàn đặt' : 'Nhận bàn thường' }]
    });
    if (reservation) {
      reservation.status = 'seated';
      reservation.statusHistory.push({ status: 'seated', changedBy: req.user._id });
      await reservation.save();
    }
    await redis.set(lockKey(String(session._id)), String(req.user._id), { EX: lockSeconds });
  } catch (error) {
    if (!session) {
      await DiningTable.updateOne({ _id: table._id, status: 'occupied' }, { $set: { status: table.status } });
    }
    throw error.code === 11000 ? new AppError(409, 'Bàn đã được nhân viên khác nhận') : error;
  }
  res.status(201).json({ session });
}));

router.post('/sessions/:id/lock', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  const key = lockKey(String(session._id));
  const userId = String(req.user._id);
  const acquired = await redis.set(key, userId, { NX: true, EX: lockSeconds });
  if (!acquired) {
    const current = await redis.get(key);
    if (current !== userId) {
      const lock = await getLock(String(session._id));
      throw new AppError(423, 'Bàn đang được ' + (lock?.ownerName || 'nhân viên khác') + ' thao tác');
    }
    await redis.expire(key, lockSeconds);
  }
  res.json({ lock: await getLock(String(session._id)) });
}));

router.delete('/sessions/:id/lock', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const key = lockKey(validId(req.params.id));
  const userId = String(req.user._id);
  await redis.eval(
    'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
    { keys: [key], arguments: [userId] }
  );
  res.status(204).end();
}));

router.post('/sessions/:id/orders', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  if (await redis.get(lockKey(String(session._id))) !== String(req.user._id)) {
    throw new AppError(423, 'Bạn cần giữ quyền thao tác bàn trước khi gọi món');
  }
  const body = z.object({
    items: z.array(z.object({
      foodId: z.string().refine(isValidObjectId, 'Mã món không hợp lệ'),
      quantity: z.coerce.number().int().min(1).max(99),
      note: z.string().trim().max(200).default('')
    })).min(1).max(40),
    note: z.string().trim().max(300).default(''),
    clientRequestId: z.string().uuid()
  }).parse(req.body);

  const previous = await Order.findOne({ tableSession: session._id, clientRequestId: body.clientRequestId });
  if (previous) return res.json({ order: previous, duplicate: true });

  const availableFoods = await Food.find({
    _id: { $in: body.items.map(i => i.foodId) }, isAvailable: true
  }).lean();
  const foodById = new Map(availableFoods.map(food => [String(food._id), food]));
  const items = body.items.map(item => {
    const food = foodById.get(item.foodId);
    if (!food) throw new AppError(409, 'Một món đã hết hoặc không còn phục vụ');
    return { food: food._id, name: food.name, price: food.price, quantity: item.quantity, note: item.note };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let order;
  try {
    order = await Order.create({
      orderCode: 'OD-' + randomUUID().slice(0, 12).toUpperCase(),
      source: 'staff', createdBy: req.user._id, tableSession: session._id,
      clientRequestId: body.clientRequestId, orderType: 'dine-in', tableNumber: session.tableNumber,
      items, note: body.note, subtotal, totalAmount: subtotal,
      status: 'confirmed', statusHistory: [{ status: 'confirmed' }]
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Order.findOne({ tableSession: session._id, clientRequestId: body.clientRequestId });
      if (existing) return res.json({ order: existing, duplicate: true });
    }
    throw error;
  }
  await TableSession.updateOne(
    { _id: session._id, status: 'active' },
    { $push: { activity: { action: 'order', by: req.user._id, detail: order.orderCode } } }
  );
  await Promise.allSettled([
    notifyRoles(['admin', 'kitchen'], {
      type: 'order', title: 'Bàn ' + session.tableNumber + ' vừa gọi món',
      message: 'Đơn ' + order.orderCode + ' có ' + items.length + ' dòng món',
      link: '/kitchen'
    })
  ]);
  res.status(201).json({ order });
}));

router.patch('/sessions/:id/close', requireRole('admin', 'cashier'), asyncHandler(async (req, res) => {
  const session = await getActiveSession(req.params.id);
  const orders = await Order.find({ tableSession: session._id, status: { $ne: 'cancelled' } }).lean();
  if (orders.some(o => o.status !== 'completed')) throw new AppError(409, 'Còn món chưa hoàn tất phục vụ');
  if (orders.some(o => o.paymentStatus !== 'paid')) throw new AppError(409, 'Còn hóa đơn chưa thanh toán');
  const closed = await TableSession.findOneAndUpdate(
    { _id: session._id, status: 'active' },
    {
      $set: { status: 'closed', closedAt: new Date(), closedBy: req.user._id },
      $push: { activity: { action: 'close', by: req.user._id, detail: 'Đã kết thúc phiên bàn' } }
    }, { new: true }
  );
  if (!closed) throw new AppError(409, 'Phiên bàn đã đóng');
  const next = await Reservation.findOne({
    table: session.table, ...activeReservationFilter()
  }).sort({ reservedAt: 1 });
  await DiningTable.updateOne(
    { _id: session.table, status: 'occupied' },
    { $set: { status: next ? 'reserved' : 'available' } }
  );
  if (session.reservation) {
    await Reservation.updateOne(
      { _id: session.reservation, status: 'seated' },
      { $set: { status: 'completed' }, $push: { statusHistory: { status: 'completed', changedBy: req.user._id } } }
    );
  }
  await redis.del(lockKey(String(session._id)));
  res.json({ session: closed, tableStatus: next ? 'reserved' : 'available' });
}));

export default router;
