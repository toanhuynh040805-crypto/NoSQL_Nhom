import { Search, Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';
import FoodCard from '../components/FoodCard.jsx';
import { api } from '../lib/api.js';

export default function MenuPage() {
  const [foods, setFoods] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api('/api/categories'), api('/api/recommendations')]).then(([cat, rec]) => {
      setCategories(cat.categories);
      setRecommended(rec.foods.slice(0, 4));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: '30' });
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      setLoading(true);
      api(`/api/foods?${params}`).then(data => setFoods(data.foods)).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [category, search]);

  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">Hương vị Việt trong từng món ăn</span>
        <h1>Món ngon tại bàn,<br/><em>chọn là có ngay.</em></h1>
        <p>Xem thực đơn, chọn món và theo dõi đơn ngay trên website. Không cần chờ gọi nhân viên.</p>
        <div className="search-box"><Search size={20} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm phở, cơm, món khai vị..." /></div>
      </div>
      <div className="hero-art"><div className="plate"><Utensils size={74} /></div><span className="leaf leaf-one">✦</span><span className="leaf leaf-two">❧</span></div>
    </section>

    {recommended.length > 0 && !search && !category && <section className="section recommendations">
      <div className="section-heading"><div><span className="eyebrow">Dành cho bạn</span><h2>Gợi ý hôm nay</h2></div><p>Neo4j phân tích sở thích và các lượt gọi món tương tự.</p></div>
      <div className="food-grid compact">{recommended.map(food => <FoodCard food={food} key={food._id} />)}</div>
    </section>}

    <section className="section menu-section">
      <div className="section-heading"><div><span className="eyebrow">Khám phá</span><h2>Thực đơn của quán</h2></div></div>
      <div className="category-tabs">
        <button className={!category ? 'active' : ''} onClick={() => setCategory('')}>Tất cả</button>
        {categories.map(item => <button key={item._id} className={category === item._id ? 'active' : ''} onClick={() => setCategory(item._id)}>{item.name}</button>)}
      </div>
      {loading ? <div className="empty">Đang tải thực đơn...</div> : foods.length
        ? <div className="food-grid">{foods.map(food => <FoodCard food={food} key={food._id} />)}</div>
        : <div className="empty">Không tìm thấy món phù hợp.</div>}
    </section>
  </>;
}

