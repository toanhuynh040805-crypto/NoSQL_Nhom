import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { isValidObjectId } from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { DiningTable } from '../models/DiningTable.js';
import { Reservation } from '../models/Reservation.js';
import { clearMenuCache } from '../services/cache.js';
import { slugify } from '../utils/slug.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const menuImageDir = path.resolve(currentDir, '../../public/images/menu');

const foodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  price: z.coerce.number().min(0),
  unit: z.string().trim().max(30).default('Phần'),
  imageUrl: z.string().trim().max(300).default(''),
  category: z.string(),
  tags: z.array(z.string().trim()).default([]),
  isAvailable: z.boolean().default(true)
});

function parsePatch(schema, input) {
  const parsed = schema.partial().parse(input);
  return Object.fromEntries(Object.keys(input).filter(key => parsed[key] !== undefined).map(key => [key, parsed[key]]));
}

router.get('/dashboard', requireRole('admin', 'staff', 'cashier'), asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [users, foods, pendingOrders, today, tables, reservations] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Food.countDocuments(),
    Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfDay }, paymentStatus: 'paid', status: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
    ]),
    DiningTable.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Reservation.countDocuments({ status: { $in: ['pending', 'confirmed'] }, reservedAt: { $gte: startOfDay } })
  ]);
  res.json({ users, foods, pendingOrders, today: today[0] || { revenue: 0, orders: 0 }, tables, reservations });
}));

router.get('/orders', requireRole('admin', 'staff', 'kitchen', 'cashier'), asyncHandler(async (req, res) => {
  const filter = req.query.status && req.query.status !== 'all' ? { status: req.query.status } : {};
  const orders = await Order.find(filter).populate('customer', 'fullName email phone').sort({ createdAt: -1 }).limit(200).lean();
  res.json({ orders });
}));

router.post('/categories', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(['food', 'drink']).default('food'),
    description: z.string().trim().max(300).default('')
  }).parse(req.body);
  const category = await Category.create({ ...body, slug: slugify(body.name) });
  await clearMenuCache();
  res.status(201).json({ category });
}));

router.put('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    type: z.enum(['food', 'drink']).optional(),
    description: z.string().trim().max(300).optional()
  }).parse(req.body);
  if (body.name) body.slug = slugify(body.name);
  const category = await Category.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!category) throw new AppError(404, 'Không tìm thấy danh mục');
  await clearMenuCache();
  res.json({ category });
}));

router.delete('/categories/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (await Food.exists({ category: req.params.id })) throw new AppError(409, 'Không thể xóa danh mục đang có món ăn');
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError(404, 'Không tìm thấy danh mục');
  await clearMenuCache();
  res.status(204).end();
}));

router.post('/foods', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = foodSchema.parse(req.body);
  if (!(await Category.exists({ _id: body.category }))) throw new AppError(400, 'Danh mục không hợp lệ');
  const food = await Food.create({ ...body, slug: `${slugify(body.name)}-${Date.now().toString(36)}` });
  await clearMenuCache();
  res.status(201).json({ food });
}));

router.put('/foods/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = parsePatch(foodSchema, req.body);
  if (body.name) body.slug = `${slugify(body.name)}-${req.params.id.slice(-5)}`;
  const food = await Food.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food });
}));

router.delete('/foods/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const food = await Food.findByIdAndUpdate(req.params.id, { isAvailable: false }, { new: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food, message: 'Đã ngừng phục vụ món ăn' });
}));

router.post('/foods/:id/image', requireRole('admin'), asyncHandler(async (req, res) => {
  const { dataUrl } = z.object({ dataUrl: z.string().max(4_500_000) }).parse(req.body);
  const matched = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!matched) throw new AppError(400, 'Ảnh phải là JPEG, PNG hoặc WebP');
  const extension = matched[1] === 'jpeg' ? 'jpg' : matched[1];
  const buffer = Buffer.from(matched[2], 'base64');
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) throw new AppError(400, 'Ảnh không hợp lệ hoặc lớn hơn 3MB');
  await fs.mkdir(menuImageDir, { recursive: true });
  const filename = `upload-${req.params.id}-${randomUUID().slice(0, 8)}.${extension}`;
  await fs.writeFile(path.join(menuImageDir, filename), buffer);
  const food = await Food.findByIdAndUpdate(req.params.id, { imageUrl: `/images/menu/${filename}` }, { new: true });
  if (!food) throw new AppError(404, 'Không tìm thấy món ăn');
  await clearMenuCache();
  res.json({ food });
}));


const employeeRoles = ['admin', 'staff', 'kitchen', 'cashier'];
const employeeRoleSchema = z.enum(['admin', 'staff', 'kitchen', 'cashier']);
const publicDirectoryFields = 'fullName email phone role isActive loyaltyPoints createdAt updatedAt';
const staffFields = 'fullName email phone role isActive createdAt updatedAt';
const staffCreateSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(80),
  email: z.email().transform(email => email.trim().toLowerCase()),
  phone: z.string().trim().max(20).default(''),
  password: z.string().min(8).max(128),
  role: employeeRoleSchema.default('staff')
});
const staffPatchSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(80).optional(),
  email: z.email().transform(email => email.trim().toLowerCase()).optional(),
  phone: z.string().trim().max(20).optional(),
  role: employeeRoleSchema.optional(),
  isActive: z.boolean().optional()
});

const validUserId = id => {
  if (!isValidObjectId(id)) throw new AppError(400, 'Mã tài khoản không hợp lệ');
  return id;
};

async function assertAdminContinuity(target, nextRole, nextActive, actorId) {
  if (String(target._id) === String(actorId) && (nextRole !== 'admin' || !nextActive)) {
    throw new AppError(409, 'Không thể tự khóa hoặc tự bỏ quyền quản trị đang sử dụng');
  }
  if (target.role === 'admin' && target.isActive && (nextRole !== 'admin' || !nextActive)) {
    if ((await User.countDocuments({ role: 'admin', isActive: true })) <= 1) {
      throw new AppError(409, 'Cần giữ ít nhất một quản trị viên đang hoạt động');
    }
  }
}

// Customers and restaurant personnel are separate administrative directories,
// but remain in the existing users collection to preserve Order/Reservation refs.
router.get('/customers', requireRole('admin'), asyncHandler(async (_req, res) => {
  const customers = await User.find({ role: 'customer' })
    .select(publicDirectoryFields).sort({ createdAt: -1 }).limit(500).lean();
  const customerIds = customers.map(customer => customer._id);
  if (!customerIds.length) return res.json({ customers: [], summary: { total: 0, active: 0, locked: 0 } });

  const [orderCounts, reservations] = await Promise.all([
    Order.aggregate([
      { $match: { customer: { $in: customerIds }, status: { $ne: 'cancelled' } } },
      { $group: {
        _id: '$customer', orderCount: { $sum: 1 },
        paidAmount: { $sum: {
          $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0]
        } }
      } }
    ]),
    Reservation.aggregate([
      { $match: { customer: { $in: customerIds } } },
      { $group: { _id: '$customer', reservationCount: { $sum: 1 } } }
    ])
  ]);
  const ordersById = new Map(orderCounts.map(item => [String(item._id), item]));
  const bookingById = new Map(reservations.map(item => [String(item._id), item.reservationCount]));
  res.json({
    customers: customers.map(customer => ({
      ...customer,
      orderCount: ordersById.get(String(customer._id))?.orderCount || 0,
      paidAmount: ordersById.get(String(customer._id))?.paidAmount || 0,
      reservationCount: bookingById.get(String(customer._id)) || 0
    })),
    summary: {
      total: customers.length, active: customers.filter(item => item.isActive).length,
      locked: customers.filter(item => !item.isActive).length
    }
  });
}));

router.patch('/customers/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.strictObject({ isActive: z.boolean() }).parse(req.body);
  const customer = await User.findOneAndUpdate(
    { _id: validUserId(req.params.id), role: 'customer' },
    { $set: body }, { new: true, runValidators: true }
  ).select(publicDirectoryFields);
  if (!customer) throw new AppError(404, 'Không tìm thấy tài khoản khách hàng');
  res.json({ customer });
}));

router.get('/employees', requireRole('admin'), asyncHandler(async (_req, res) => {
  const employees = await User.find({ role: { $in: employeeRoles } })
    .select(staffFields).sort({ createdAt: -1 }).limit(300).lean();
  res.json({
    employees,
    summary: {
      total: employees.length,
      active: employees.filter(employee => employee.isActive).length,
      locked: employees.filter(employee => !employee.isActive).length,
      byRole: employeeRoles.reduce((acc, role) => ({
        ...acc, [role]: employees.filter(employee => employee.role === role).length
      }), {})
    }
  });
}));

router.post('/employees', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = staffCreateSchema.parse(req.body);
  if (await User.exists({ email: body.email })) {
    throw new AppError(409, 'Email đã được sử dụng');
  }
  try {
    const employee = await User.create({
      fullName: body.fullName, email: body.email, phone: body.phone,
      role: body.role, isActive: true, passwordHash: await bcrypt.hash(body.password, 11)
    });
    res.status(201).json({
      employee: {
        _id: employee._id, fullName: employee.fullName, email: employee.email,
        phone: employee.phone, role: employee.role, isActive: employee.isActive,
        createdAt: employee.createdAt
      }
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'Email đã được sử dụng');
    throw error;
  }
}));

router.patch('/employees/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = staffPatchSchema.parse(req.body);
  if (Object.keys(body).length === 0) throw new AppError(400, 'Chưa chọn thông tin cần cập nhật');
  const id = validUserId(req.params.id);
  const previous = await User.findOne({ _id: id, role: { $in: employeeRoles } });
  if (!previous) throw new AppError(404, 'Không tìm thấy tài khoản nhân viên');
  await assertAdminContinuity(
    previous, body.role ?? previous.role, body.isActive ?? previous.isActive, req.user._id
  );
  if (body.email && body.email !== previous.email &&
    await User.exists({ email: body.email, _id: { $ne: previous._id } })) {
    throw new AppError(409, 'Email đã được sử dụng');
  }
  try {
    const employee = await User.findOneAndUpdate(
      { _id: id, role: { $in: employeeRoles } },
      { $set: body }, { new: true, runValidators: true }
    ).select(staffFields);
    if (!employee) throw new AppError(409, 'Tài khoản vừa được cập nhật, hãy tải lại');
    res.json({ employee });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'Email đã được sử dụng');
    throw error;
  }
}));

router.get('/users', requireRole('admin'), asyncHandler(async (req, res) => {
  const filter = req.query.role && req.query.role !== 'all' ? { role: req.query.role } : {};
  const users = await User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).limit(300).lean();
  res.json({ users });
}));

// Backward-compatible legacy endpoint, with account-type boundaries enforced.
router.patch('/users/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const body = z.strictObject({
    role: z.enum(['customer', 'admin', 'staff', 'kitchen', 'cashier']).optional(),
    isActive: z.boolean().optional()
  }).parse(req.body);
  if (!Object.keys(body).length) throw new AppError(400, 'Chưa chọn thông tin cần cập nhật');
  const user = await User.findById(validUserId(req.params.id));
  if (!user) throw new AppError(404, 'Không tìm thấy người dùng');
  const nextRole = body.role ?? user.role;
  const nextActive = body.isActive ?? user.isActive;
  if ((user.role === 'customer') !== (nextRole === 'customer')) {
    throw new AppError(409, 'Không thể chuyển trực tiếp khách hàng thành nhân viên hoặc ngược lại');
  }
  if (user.role !== 'customer') {
    await assertAdminContinuity(user, nextRole, nextActive, req.user._id);
  } else if (String(user._id) === String(req.user._id) && body.isActive === false) {
    throw new AppError(409, 'Không thể tự khóa tài khoản');
  }
  const updatedUser = await User.findByIdAndUpdate(
    user._id, { $set: body }, { new: true, runValidators: true }
  ).select(publicDirectoryFields);
  res.json({ user: updatedUser });
}));

router.get('/reports', requireRole('admin', 'cashier'), asyncHandler(async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  to.setHours(23, 59, 59, 999);
  const match = { createdAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' }, paymentStatus: 'paid' };
  const [summary, daily, topFoods, statusCounts] = await Promise.all([
    Order.aggregate([{ $match: match }, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, averageOrder: { $avg: '$totalAmount' } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.food', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }, { $sort: { quantity: -1 } }, { $limit: 10 }]),
    Order.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);
  res.json({ from, to, summary: summary[0] || { revenue: 0, orders: 0, averageOrder: 0 }, daily, topFoods, statusCounts });
}));

export default router;

