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
  { category: 'khai-vi', name: 'Chả giò hải sản', description: 'Chả giò chiên giòn dùng kèm rau sống', price: 72000, unit: 'Đĩa', image: 2, tags: ['chiên giòn', 'hải sản'] },
  { category: 'khai-vi', name: 'Súp cua trứng bắc thảo', description: 'Súp cua sánh mịn, thơm tiêu và ngò', price: 52000, unit: 'Chén', image: 3, tags: ['súp', 'cua'] },
  { category: 'mon-chinh', name: 'Phở bò đặc biệt', description: 'Phở truyền thống với nước dùng hầm xương', price: 65000, unit: 'Tô', image: 4, tags: ['bò', 'truyền thống'] },
  { category: 'mon-chinh', name: 'Cơm chiên Dương Châu', description: 'Cơm chiên hạt vàng, tôm, trứng và xá xíu', price: 75000, unit: 'Đĩa', image: 5, tags: ['cơm', 'tôm'] },
  { category: 'mon-chinh', name: 'Bò lúc lắc khoai tây', description: 'Thăn bò áp chảo và khoai tây chiên', price: 125000, unit: 'Phần', image: 6, tags: ['bò', 'áp chảo'] },
  { category: 'mon-chinh', name: 'Cá diêu hồng sốt xoài', description: 'Cá chiên giòn phủ sốt xoài chua ngọt', price: 180000, unit: 'Con', image: 7, tags: ['cá', 'chua ngọt'] },
  { category: 'mon-chinh', name: 'Lẩu Thái hải sản', description: 'Nước lẩu chua cay cùng hải sản tươi', price: 295000, unit: 'Nồi', image: 8, tags: ['lẩu', 'hải sản', 'cay'] },
  { category: 'do-uong', name: 'Trà đá thanh nhiệt', description: 'Trà đá mát lạnh giải khát', price: 5000, unit: 'Ly', image: 9, tags: ['trà', 'lạnh'] },
  { category: 'do-uong', name: 'Trà đào cam sả', description: 'Trà đào thơm dịu cùng cam và sả', price: 39000, unit: 'Ly', image: 10, tags: ['trà', 'trái cây'] },
  { category: 'do-uong', name: 'Nước ép dưa hấu', description: 'Dưa hấu ép nguyên chất', price: 35000, unit: 'Ly', image: 11, tags: ['nước ép', 'trái cây'] },
  { category: 'trang-mieng', name: 'Chè khúc bạch', description: 'Khúc bạch mềm, nhãn và hạnh nhân', price: 38000, unit: 'Chén', image: 12, tags: ['chè', 'ngọt'] }
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
    { name: 'Đồ uống', slug: 'do-uong', type: 'drink', description: 'Thức uống giải khát' },
    { name: 'Tráng miệng', slug: 'trang-mieng', type: 'food', description: 'Món ngọt kết thúc bữa ăn' }
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

