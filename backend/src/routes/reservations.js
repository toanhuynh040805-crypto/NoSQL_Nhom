import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { DiningTable } from '../models/DiningTable.js';
import { Reservation } from '../models/Reservation.js';
import { notifyRoles, notifyUser } from '../services/notifications.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    reservedAt: z.coerce.date(),
    guestCount: z.coerce.number().int().min(1).max(50),
    phone: z.string().trim().min(8).max(20),
    areaPreference: z.string().trim().max(80).default(''),
    note: z.string().trim().max(300).default('')
  }).parse(req.body);
  if (body.reservedAt.getTime() < Date.now() + 30 * 60 * 1000) throw new AppError(400, 'Vui lòng đặt bàn trước ít nhất 30 phút');
  const reservation = await Reservation.create({
    reservationCode: `RS${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 3).toUpperCase()}`,
    customer: req.user._id, customerName: req.user.fullName, phone: body.phone,
    reservedAt: body.reservedAt, guestCount: body.guestCount,
    areaPreference: body.areaPreference, note: body.note,
    statusHistory: [{ status: 'pending', changedBy: req.user._id }]
  });
  await notifyRoles(['admin', 'staff'], {
    type: 'reservation', title: 'Có yêu cầu đặt bàn mới',
    message: `${req.user.fullName} đặt bàn cho ${body.guestCount} khách`, link: '/operations?tab=reservations'
  });
  res.status(201).json({ reservation });
}));

router.get('/mine', asyncHandler(async (req, res) => {
  const reservations = await Reservation.find({ customer: req.user._id }).populate('table').sort({ reservedAt: -1 }).lean();
  res.json({ reservations });
}));

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const reservation = await Reservation.findOne({ _id: req.params.id, customer: req.user._id });
  if (!reservation) throw new AppError(404, 'Không tìm thấy yêu cầu đặt bàn');
  if (!['pending', 'confirmed'].includes(reservation.status)) throw new AppError(409, 'Không thể hủy đặt bàn ở trạng thái hiện tại');
  reservation.status = 'cancelled';
  reservation.statusHistory.push({ status: 'cancelled', changedBy: req.user._id });
  await reservation.save();
  res.json({ reservation });
}));

router.get('/', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const filter = req.query.status && req.query.status !== 'all' ? { status: req.query.status } : {};
  const reservations = await Reservation.find(filter).populate('customer', 'fullName phone email').populate('table').sort({ reservedAt: 1 }).limit(200).lean();
  res.json({ reservations });
}));

router.patch('/:id/status', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no-show']),
    tableId: z.string().optional()
  }).parse(req.body);
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) throw new AppError(404, 'Không tìm thấy đặt bàn');
  if (body.tableId) {
    const table = await DiningTable.findById(body.tableId);
    if (!table || table.status === 'inactive' || table.capacity < reservation.guestCount) throw new AppError(400, 'Bàn không phù hợp');
    reservation.table = table._id;
    if (body.status === 'confirmed') table.status = 'reserved';
    if (body.status === 'seated') table.status = 'occupied';
    await table.save();
  }
  if (['completed', 'cancelled', 'no-show'].includes(body.status) && reservation.table) {
    await DiningTable.updateOne({ _id: reservation.table }, { status: 'available' });
  }
  reservation.status = body.status;
  reservation.statusHistory.push({ status: body.status, changedBy: req.user._id });
  await reservation.save();
  await notifyUser(reservation.customer, {
    type: 'reservation', title: 'Cập nhật đặt bàn',
    message: `Yêu cầu ${reservation.reservationCode} đã chuyển sang trạng thái ${body.status}`,
    link: '/reservations'
  });
  res.json({ reservation: await reservation.populate('table') });
}));

export default router;

