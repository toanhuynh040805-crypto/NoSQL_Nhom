import bcrypt from 'bcryptjs';
import { connectDatabases, closeDatabases, redis } from '../config/database.js';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { clearGraphData, ensureGraphConstraints, recordOrderGraph, syncCatalogGraph } from '../services/graph.js';

const catalog = [
  { category: 'khai-vi', name: 'Gỏi ngó sen tôm thịt', description: 'Ngó sen giòn, tôm thịt và rau thơm', price: 65000, unit: 'Đĩa', image: 1, tags: ['thanh mát', 'tôm'] },
  { category: 'mon-chinh', name: 'Cơm chiên Dương Châu', description: 'Cơm chiên hạt vàng, tôm, trứng và xá xíu', price: 75000, unit: 'Đĩa', image: 2, tags: ['cơm', 'tôm'] },
  { category: 'do-uong', name: 'Trà đá thanh nhiệt', description: 'Trà đá mát lạnh giải khát', price: 5000, unit: 'Ly', image: 3, tags: ['trà', 'lạnh'] },
  { category: 'do-them', name: 'Khăn lạnh', description: 'Khăn lạnh dùng tại bàn', price: 4000, unit: 'Cái', image: 4, tags: ['khăn lạnh'] },
  { category: 'lau-bo', name: 'Lẩu bò 2-3 người (Thường)', description: 'Nồi lẩu bò phần thường dành cho 2-3 người', price: 220000, unit: 'Nồi', image: 5, tags: ['lẩu bò', '2-3 người'] },
  { category: 'lau-bo', name: 'Lẩu bò 2-3 người (Đặc biệt)', description: 'Nồi lẩu bò phần đặc biệt dành cho 2-3 người', price: 280000, unit: 'Nồi', image: 6, tags: ['lẩu bò', '2-3 người', 'đặc biệt'] },
  { category: 'lau-bo', name: 'Lẩu bò 4-5 người (Thường)', description: 'Nồi lẩu bò phần thường dành cho 4-5 người', price: 330000, unit: 'Nồi', image: 7, tags: ['lẩu bò', '4-5 người'] },
  { category: 'lau-bo', name: 'Lẩu bò 4-5 người (Đặc biệt)', description: 'Nồi lẩu bò phần đặc biệt dành cho 4-5 người', price: 390000, unit: 'Nồi', image: 8, tags: ['lẩu bò', '4-5 người', 'đặc biệt'] },
  { category: 'lau-bo', name: 'Lẩu bò 6-8 người (Thường)', description: 'Nồi lẩu bò phần thường dành cho 6-8 người', price: 440000, unit: 'Nồi', image: 9, tags: ['lẩu bò', '6-8 người'] },
  { category: 'lau-bo', name: 'Lẩu bò 6-8 người (Đặc biệt)', description: 'Nồi lẩu bò phần đặc biệt dành cho 6-8 người', price: 500000, unit: 'Nồi', image: 10, tags: ['lẩu bò', '6-8 người', 'đặc biệt'] },
  { category: 'mon-nham', name: 'Bò viên chiên', description: 'Bò viên chiên nóng dùng kèm tương ớt', price: 60000, unit: 'Phần', image: 11, tags: ['bò viên', 'chiên'] },
  { category: 'mon-nham', name: 'Chân gà sả tắc', description: 'Chân gà giòn thấm vị sả tắc', price: 99000, unit: 'Đĩa', image: 12, tags: ['chân gà', 'sả tắc'] }
];

async function seed() {
  await connectDatabases();
  await ensureGraphConstraints();
  await clearGraphData();
  await Promise.all([Order.deleteMany({}), Review.deleteMany({}), Food.deleteMany({}), Category.deleteMany({}), User.deleteMany({})]);
  await redis.flushDb();

  const categories = await Category.insertMany([
    { name: 'Khai vị', slug: 'khai-vi', type: 'food', description: 'Món nhẹ mở đầu bữa ăn' },
    { name: 'Món chính', slug: 'mon-chinh', type: 'food', description: 'Các món ăn chính của quán' },
    { name: 'Lẩu bò', slug: 'lau-bo', type: 'food', description: 'Các phần lẩu bò theo số lượng khách' },
    { name: 'Món nhắm', slug: 'mon-nham', type: 'food', description: 'Món ăn kèm và món nhắm' },
    { name: 'Đồ thêm', slug: 'do-them', type: 'food', description: 'Các món và vật dụng gọi thêm' },
    { name: 'Đồ uống', slug: 'do-uong', type: 'drink', description: 'Thức uống giải khát' }
  ]);
  const categoryMap = new Map(categories.map(category => [category.slug, category]));
  const foods = await Food.insertMany(catalog.map((item, index) => ({
    name: item.name,
    slug: `${item.category}-${index + 1}`,
    description: item.description,
    price: item.price,
    unit: item.unit,
    imageUrl: `/images/menu/menu-${item.image}.jpg`,
    category: categoryMap.get(item.category)._id,
    tags: item.tags,
    isAvailable: true,
    soldCount: Math.max(0, 24 - index * 2)
  })));
  const passwordHash = await bcrypt.hash('123456', 11);
  const users = await User.insertMany([
    { fullName: 'Quản trị viên', email: 'admin@quanan.vn', phone: '0901111222', passwordHash, role: 'admin' },
    { fullName: 'Khách hàng demo', email: 'khach@quanan.vn', phone: '0988123456', passwordHash, role: 'customer' },
    { fullName: 'Nguyễn Văn An', email: 'an@quanan.vn', phone: '0912345678', passwordHash, role: 'customer' },
    { fullName: 'Trần Thị Bình', email: 'binh@quanan.vn', phone: '0977654321', passwordHash, role: 'customer' }
  ]);
  const populatedFoods = await Food.find().populate('category');
  await syncCatalogGraph(categories.map(category => ({ id: category.id, name: category.name })), populatedFoods.map(food => ({
    id: food.id, name: food.name, price: food.price,
    category: { id: food.category.id, name: food.category.name }
  })));
  for (const food of foods) await redis.zAdd('leaderboard:foods', { score: food.soldCount, value: food.id });

  const sampleOrders = await Order.insertMany([
    {
      orderCode: 'OD-DEMO-001', customer: users[1]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A1',
      items: [0].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: foods[0].price, statusHistory: [{ status: 'completed' }]
    },
    {
      orderCode: 'OD-SEED-AN', customer: users[2]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A2',
      items: [0, 1, 3].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 1, 3].reduce((sum, index) => sum + foods[index].price, 0), statusHistory: [{ status: 'completed' }]
    },
    {
      orderCode: 'OD-SEED-BINH', customer: users[3]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A3',
      items: [0, 4, 7].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 4, 7].reduce((sum, index) => sum + foods[index].price, 0), statusHistory: [{ status: 'completed' }]
    }
  ]);
  await Promise.all(sampleOrders.map((order, index) => recordOrderGraph(users[index + 1], order)));

  console.log('Seed completed');
  console.log('Admin: admin@quanan.vn / 123456');
  console.log('Customer: khach@quanan.vn / 123456');
}

seed().then(closeDatabases).catch(async error => {
  console.error(error);
  await closeDatabases();
  process.exit(1);
});

