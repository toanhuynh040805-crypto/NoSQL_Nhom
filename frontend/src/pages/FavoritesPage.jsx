import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import FoodCard from '../components/FoodCard.jsx';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';

export default function FavoritesPage() {
  const { user, favoriteIds } = useApp();
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user) api('/api/favorites').then(data => setFoods(data.foods)).finally(() => setLoading(false));
  }, [user, favoriteIds.length]);
  if (!user) return <Navigate to="/login?next=/favorites" replace />;
  return <section className="page">
    <div className="page-title"><div><span className="eyebrow">Danh sách cá nhân</span><h1>Món yêu thích</h1></div></div>
    {loading ? <div className="empty">Đang tải...</div> : foods.length
      ? <div className="food-grid">{foods.map(food => <FoodCard key={food._id} food={food} />)}</div>
      : <div className="empty-cart"><Heart size={56}/><h2>Chưa có món yêu thích</h2><p>Nhấn biểu tượng trái tim trên món ăn để lưu tại đây.</p></div>}
  </section>;
}

