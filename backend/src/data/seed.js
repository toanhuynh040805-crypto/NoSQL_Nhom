import bcrypt from 'bcryptjs';
import { connectDatabases, closeDatabases, redis } from '../config/database.js';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { DiningTable } from '../models/DiningTable.js';
import { Reservation } from '../models/Reservation.js';
import { Promotion } from '../models/Promotion.js';
import { Notification } from '../models/Notification.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { clearGraphData, ensureGraphConstraints, recordOrderGraph, syncCatalogGraph } from '../services/graph.js';

const catalog = [
  { category: 'lau-bo', name: 'Lẩu bò 2-3 người (Thường)', description: 'Nồi lẩu bò phần thường dành cho 2-3 người', price: 220000, unit: 'Nồi', imageFile: 'klcn-menu-6.jpg', tags: ['lẩu bò', '2-3 người'] },
  { category: 'lau-bo', name: 'Lẩu bò 2-3 người (Đặc biệt)', description: 'Nồi lẩu bò phần đặc biệt dành cho 2-3 người', price: 280000, unit: 'Nồi', imageFile: 'klcn-menu-7.jpg', tags: ['lẩu bò', '2-3 người', 'đặc biệt'] },
  { category: 'lau-bo', name: 'Lẩu bò 4-5 người (Thường)', description: 'Nồi lẩu bò phần thường dành cho 4-5 người', price: 330000, unit: 'Nồi', imageFile: 'klcn-menu-8.jpg', tags: ['lẩu bò', '4-5 người'] },
  { category: 'lau-bo', name: 'Lẩu bò 4-5 người (Đặc biệt)', description: 'Nồi lẩu bò phần đặc biệt dành cho 4-5 người', price: 390000, unit: 'Nồi', imageFile: 'klcn-menu-9.jpg', tags: ['lẩu bò', '4-5 người', 'đặc biệt'] },
  { category: 'lau-bo', name: 'Lẩu bò 6-8 người (Thường)', description: 'Nồi lẩu bò phần thường dành cho 6-8 người', price: 440000, unit: 'Nồi', imageFile: 'klcn-menu-10.jpg', tags: ['lẩu bò', '6-8 người'] },
  { category: 'lau-bo', name: 'Lẩu bò 6-8 người (Đặc biệt)', description: 'Nồi lẩu bò phần đặc biệt dành cho 6-8 người', price: 500000, unit: 'Nồi', imageFile: 'klcn-menu-11.jpg', tags: ['lẩu bò', '6-8 người', 'đặc biệt'] },

  { category: 'mon-nham', name: 'Bò viên chiên', description: 'Bò viên chiên nóng dùng kèm tương ớt', price: 60000, unit: 'Phần', imageFile: 'klcn-menu-12.jpg', tags: ['bò viên', 'chiên'] },
  { category: 'mon-nham', name: 'Chân gà sả tắc', description: 'Chân gà giòn thấm vị sả tắc', price: 99000, unit: 'Đĩa', imageFile: 'klcn-menu-13.jpg', tags: ['chân gà', 'sả tắc'] },
  { category: 'mon-nham', name: 'Gỏi lưỡi bò', description: 'Lưỡi bò trộn gỏi chua ngọt cùng rau thơm', price: 70000, unit: 'Đĩa', imageFile: 'klcn-menu-14.jpg', tags: ['gỏi', 'lưỡi bò'] },
  { category: 'mon-nham', name: 'Gỏi bò + khoai môn', description: 'Gỏi bò dùng kèm khoai môn chiên giòn', price: 139000, unit: 'Đĩa', imageFile: 'klcn-menu-15.jpg', tags: ['gỏi bò', 'khoai môn'] },
  { category: 'mon-nham', name: 'Bò tơ + rau rừng', description: 'Bò tơ mềm dùng cùng các loại rau rừng', price: 159000, unit: 'Đĩa', imageFile: 'klcn-menu-16.jpg', tags: ['bò tơ', 'rau rừng'] },
  { category: 'mon-nham', name: 'Bò tơ cháy mè', description: 'Bò tơ thơm mè rang, đậm vị', price: 149000, unit: 'Đĩa', imageFile: 'klcn-menu-17.jpg', tags: ['bò tơ', 'mè'] },
  { category: 'mon-nham', name: 'Bò một nắng đặc biệt', description: 'Bò một nắng nướng thơm dùng kèm muối chấm', price: 99000, unit: 'Đĩa', imageFile: 'klcn-menu-18.jpg', tags: ['bò một nắng', 'nướng'] },

  { category: 'do-nhung-them', name: 'Bò viên thêm (nhỏ)', description: 'Phần bò viên nhỏ gọi thêm cho lẩu', price: 60000, unit: 'Phần', imageFile: 'klcn-menu-19.jpg', tags: ['bò viên', 'đồ nhúng'] },
  { category: 'do-nhung-them', name: 'Bò viên thêm (lớn)', description: 'Phần bò viên lớn gọi thêm cho lẩu', price: 115000, unit: 'Phần', imageFile: 'klcn-menu-20.jpg', tags: ['bò viên', 'đồ nhúng'] },
  { category: 'do-nhung-them', name: 'Thịt thêm (nhỏ)', description: 'Phần thịt bò nhỏ gọi thêm cho lẩu', price: 60000, unit: 'Phần', imageFile: 'klcn-menu-21.jpg', tags: ['thịt bò', 'đồ nhúng'] },
  { category: 'do-nhung-them', name: 'Thịt thêm (lớn)', description: 'Phần thịt bò lớn gọi thêm cho lẩu', price: 115000, unit: 'Phần', imageFile: 'klcn-menu-22.jpg', tags: ['thịt bò', 'đồ nhúng'] },
  { category: 'do-nhung-them', name: 'Gân thêm (nhỏ)', description: 'Phần gân bò nhỏ gọi thêm cho lẩu', price: 60000, unit: 'Phần', imageFile: 'klcn-menu-23.jpg', tags: ['gân bò', 'đồ nhúng'] },
  { category: 'do-nhung-them', name: 'Gân thêm (lớn)', description: 'Phần gân bò lớn gọi thêm cho lẩu', price: 115000, unit: 'Phần', imageFile: 'klcn-menu-24.jpg', tags: ['gân bò', 'đồ nhúng'] },

  { category: 'mon-them', name: 'Đậu hủ ky', description: 'Đậu hủ ky dùng thêm với lẩu', price: 16000, unit: 'Phần', imageFile: 'klcn-menu-25.jpg', tags: ['đậu hủ ky', 'món thêm'] },
  { category: 'mon-them', name: 'Đậu hủ non', description: 'Đậu hủ non mềm dùng thêm với lẩu', price: 11000, unit: 'Phần', imageFile: 'klcn-menu-26.png', tags: ['đậu hủ non', 'món thêm'] },
  { category: 'mon-them', name: 'Bánh phở', description: 'Phần bánh phở gọi thêm', price: 14000, unit: 'Phần', imageFile: 'klcn-menu-27.jpg', tags: ['bánh phở', 'món thêm'] },
  { category: 'mon-them', name: 'Mì vắt', description: 'Phần mì vắt gọi thêm', price: 12000, unit: 'Phần', imageFile: 'klcn-menu-28.jpg', tags: ['mì vắt', 'món thêm'] },
  { category: 'mon-them', name: 'Mì gói', description: 'Mì gói dùng thêm với lẩu', price: 6000, unit: 'Gói', imageFile: 'klcn-menu-29.jpg', tags: ['mì gói', 'món thêm'] },
  { category: 'dich-vu-tai-ban', name: 'Khăn lạnh', description: 'Khăn lạnh dùng tại bàn', price: 4000, unit: 'Cái', imageFile: 'klcn-menu-5.jpg', tags: ['khăn lạnh', 'tại bàn'] },

  { category: 'nuoc-giai-khat', name: 'Trà tắc mật ong đường phèn', description: 'Trà tắc chua ngọt cùng mật ong và đường phèn', price: 22000, unit: 'Ly', imageFile: 'klcn-menu-30.jpg', tags: ['trà tắc', 'mật ong'] },
  { category: 'nuoc-giai-khat', name: 'Pepsi', description: 'Nước ngọt Pepsi dùng lạnh', price: 17000, unit: 'Lon', imageFile: 'klcn-menu-31.jpg', tags: ['nước ngọt', 'pepsi'] },
  { category: 'nuoc-giai-khat', name: 'Coca', description: 'Nước ngọt Coca-Cola dùng lạnh', price: 17000, unit: 'Lon', imageFile: 'klcn-menu-32.jpg', tags: ['nước ngọt', 'coca'] },
  { category: 'nuoc-giai-khat', name: '7up', description: 'Nước ngọt 7up dùng lạnh', price: 17000, unit: 'Lon', imageFile: 'klcn-menu-33.jpg', tags: ['nước ngọt', '7up'] },
  { category: 'nuoc-giai-khat', name: 'Sting', description: 'Nước tăng lực Sting dùng lạnh', price: 17000, unit: 'Chai', imageFile: 'klcn-menu-34.jpg', tags: ['nước tăng lực', 'sting'] },
  { category: 'nuoc-giai-khat', name: 'Xá xị', description: 'Nước ngọt xá xị dùng lạnh', price: 17000, unit: 'Lon', imageFile: 'klcn-menu-35.jpg', tags: ['nước ngọt', 'xá xị'] },
  { category: 'nuoc-giai-khat', name: 'Nước suối', description: 'Nước suối đóng chai', price: 14000, unit: 'Chai', imageFile: 'klcn-menu-36.jpg', tags: ['nước suối'] },

  { category: 'bia', name: 'Ken bạc', description: 'Bia Heineken Silver dùng lạnh', price: 26000, unit: 'Lon', imageFile: 'klcn-menu-37.jpg', tags: ['bia', 'heineken'] },
  { category: 'bia', name: 'Ken xanh', description: 'Bia Heineken xanh dùng lạnh', price: 29000, unit: 'Lon', imageFile: 'klcn-menu-38.jpg', tags: ['bia', 'heineken'] },
  { category: 'bia', name: 'Ken lùn', description: 'Bia Heineken chai lùn dùng lạnh', price: 24000, unit: 'Chai', imageFile: 'klcn-menu-39.jpg', tags: ['bia', 'heineken'] },
  { category: 'bia', name: 'Tiger nâu - bạc', description: 'Bia Tiger dùng lạnh', price: 25000, unit: 'Lon', imageFile: 'klcn-menu-40.png', tags: ['bia', 'tiger'] },
  { category: 'bia', name: 'Bia hơi', description: 'Bia hơi phục vụ theo tháp', price: 63000, unit: 'Tháp', imageFile: 'klcn-menu-41.png', tags: ['bia hơi', 'tháp bia'] }
];

async function seed() {
  await connectDatabases();
  await ensureGraphConstraints();
  await clearGraphData();
  await Promise.all([
    Order.deleteMany({}), Review.deleteMany({}), Food.deleteMany({}), Category.deleteMany({}),
    User.deleteMany({}), DiningTable.deleteMany({}), Reservation.deleteMany({}),
    Promotion.deleteMany({}), Notification.deleteMany({}), InventoryItem.deleteMany({})
  ]);
  await redis.flushDb();

  const categories = await Category.insertMany([
    { name: 'Lẩu bò', slug: 'lau-bo', type: 'food', description: 'Các phần lẩu bò theo số lượng khách' },
    { name: 'Món nhắm', slug: 'mon-nham', type: 'food', description: 'Món ăn kèm và món nhắm' },
    { name: 'Đồ nhúng thêm', slug: 'do-nhung-them', type: 'food', description: 'Thịt, gân và bò viên gọi thêm cho lẩu' },
    { name: 'Món thêm', slug: 'mon-them', type: 'food', description: 'Đậu hủ, bánh phở và mì gọi thêm' },
    { name: 'Dịch vụ tại bàn', slug: 'dich-vu-tai-ban', type: 'food', description: 'Vật dụng phục vụ tại bàn' },
    { name: 'Nước giải khát', slug: 'nuoc-giai-khat', type: 'drink', description: 'Trà, nước ngọt và nước suối' },
    { name: 'Bia', slug: 'bia', type: 'drink', description: 'Các loại bia phục vụ tại quán' }
  ]);
  const categoryMap = new Map(categories.map(category => [category.slug, category]));
  const foods = await Food.insertMany(catalog.map((item, index) => ({
    name: item.name,
    slug: `${item.category}-${index + 1}`,
    description: item.description,
    price: item.price,
    unit: item.unit,
    imageUrl: `/images/menu/${item.imageFile}`,
    category: categoryMap.get(item.category)._id,
    tags: item.tags,
    isAvailable: true,
    soldCount: Math.max(1, 50 - index)
  })));
  const passwordHash = await bcrypt.hash('123456', 11);
  const users = await User.insertMany([
    { fullName: 'Quản trị viên', email: 'admin@quanan.vn', phone: '0901111222', passwordHash, role: 'admin' },
    { fullName: 'Nhân viên phục vụ', email: 'staff@quanan.vn', phone: '0902222333', passwordHash, role: 'staff' },
    { fullName: 'Nhân viên bếp', email: 'bep@quanan.vn', phone: '0903333444', passwordHash, role: 'kitchen' },
    { fullName: 'Nhân viên thu ngân', email: 'thungan@quanan.vn', phone: '0904444555', passwordHash, role: 'cashier' },
    { fullName: 'Khách hàng demo', email: 'khach@quanan.vn', phone: '0988123456', passwordHash, role: 'customer' },
    { fullName: 'Nguyễn Văn An', email: 'an@quanan.vn', phone: '0912345678', passwordHash, role: 'customer' },
    { fullName: 'Trần Thị Bình', email: 'binh@quanan.vn', phone: '0977654321', passwordHash, role: 'customer' }
  ]);

  const tables = await DiningTable.insertMany([
    ...Array.from({ length: 8 }, (_, index) => ({ name: `T1-A${index + 1}`, area: 'Tầng 1 - Khu A', capacity: 4 })),
    ...Array.from({ length: 8 }, (_, index) => ({ name: `T1-B${index + 1}`, area: 'Tầng 1 - Khu B', capacity: index < 4 ? 4 : 6 })),
    ...Array.from({ length: 4 }, (_, index) => ({ name: `T2-A${index + 1}`, area: 'Tầng 2', capacity: 8 })),
    { name: 'VIP-01', area: 'Phòng VIP', capacity: 10, description: 'Phòng riêng có máy lạnh' },
    { name: 'VIP-02', area: 'Phòng VIP', capacity: 15, description: 'Phòng riêng dành cho tiệc' }
  ]);

  const now = new Date();
  await Promotion.insertMany([
    {
      name: 'Chào mừng khách mới', code: 'WELCOME10', description: 'Giảm 10% cho đơn từ 200.000đ',
      discountType: 'percent', discountValue: 10, minOrderValue: 200000, maxDiscount: 50000,
      startAt: new Date(now.getFullYear(), 0, 1), endAt: new Date(now.getFullYear() + 1, 11, 31), isActive: true
    },
    {
      name: 'Giảm 30.000đ', code: 'GIAM30K', description: 'Giảm 30.000đ cho đơn từ 300.000đ',
      discountType: 'fixed', discountValue: 30000, minOrderValue: 300000,
      startAt: new Date(now.getFullYear(), 0, 1), endAt: new Date(now.getFullYear() + 1, 11, 31), isActive: true
    }
  ]);

  await InventoryItem.insertMany([
    { name: 'Thịt bò', unit: 'kg', currentStock: 25, minimumStock: 8, supplier: 'Nhà cung cấp thịt bò' },
    { name: 'Gân bò', unit: 'kg', currentStock: 12, minimumStock: 4, supplier: 'Nhà cung cấp thịt bò' },
    { name: 'Bò viên', unit: 'kg', currentStock: 9, minimumStock: 3, supplier: 'Cơ sở bò viên' },
    { name: 'Rau ăn lẩu', unit: 'kg', currentStock: 7, minimumStock: 5, supplier: 'Chợ đầu mối' },
    { name: 'Mì vắt', unit: 'vắt', currentStock: 80, minimumStock: 20, supplier: 'Nhà cung cấp thực phẩm' },
    { name: 'Nước ngọt', unit: 'thùng', currentStock: 15, minimumStock: 5, supplier: 'Đại lý nước giải khát' }
  ]);
  const populatedFoods = await Food.find().populate('category');
  await syncCatalogGraph(categories.map(category => ({ id: category.id, name: category.name })), populatedFoods.map(food => ({
    id: food.id, name: food.name, price: food.price,
    category: { id: food.category.id, name: food.category.name }
  })));
  for (const food of foods) await redis.zAdd('leaderboard:foods', { score: food.soldCount, value: food.id });

  const sampleOrders = await Order.insertMany([
    {
      orderCode: 'OD-DEMO-001', customer: users[4]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A1',
      items: [0, 25].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 25].reduce((sum, index) => sum + foods[index].price, 0),
      totalAmount: [0, 25].reduce((sum, index) => sum + foods[index].price, 0), paymentStatus: 'paid', paymentMethod: 'cash',
      statusHistory: [{ status: 'completed' }]
    },
    {
      orderCode: 'OD-SEED-AN', customer: users[5]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A2',
      items: [0, 6, 25].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 6, 25].reduce((sum, index) => sum + foods[index].price, 0),
      totalAmount: [0, 6, 25].reduce((sum, index) => sum + foods[index].price, 0), paymentStatus: 'paid', paymentMethod: 'cash',
      statusHistory: [{ status: 'completed' }]
    },
    {
      orderCode: 'OD-SEED-BINH', customer: users[6]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A3',
      items: [0, 7, 26].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 7, 26].reduce((sum, index) => sum + foods[index].price, 0),
      totalAmount: [0, 7, 26].reduce((sum, index) => sum + foods[index].price, 0), paymentStatus: 'paid', paymentMethod: 'cash',
      statusHistory: [{ status: 'completed' }]
    }
  ]);
  await Promise.all(sampleOrders.map((order, index) => recordOrderGraph(users[index + 4], order)));

  await Reservation.create({
    reservationCode: 'RS-DEMO-001', customer: users[4]._id, customerName: users[4].fullName,
    phone: users[4].phone, reservedAt: new Date(Date.now() + 24 * 60 * 60 * 1000), guestCount: 4,
    table: tables[0]._id, areaPreference: 'Tầng 1', status: 'confirmed',
    statusHistory: [{ status: 'confirmed', changedBy: users[0]._id }]
  });
  await DiningTable.updateOne({ _id: tables[0]._id }, { status: 'reserved' });

  console.log('Seed completed');
  console.log('Admin: admin@quanan.vn / 123456');
  console.log('Customer: khach@quanan.vn / 123456');
  console.log('Staff: staff@quanan.vn / 123456');
  console.log('Kitchen: bep@quanan.vn / 123456');
  console.log('Cashier: thungan@quanan.vn / 123456');
}

seed().then(closeDatabases).catch(async error => {
  console.error(error);
  await closeDatabases();
  process.exit(1);
});

