import { Heart, Plus, Star } from 'lucide-react';
import { money } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';

export default function FoodCard({ food }) {
  const { addToCart, favoriteIds, toggleFavorite, notify } = useApp();
  const favorite = favoriteIds.includes(food._id);
  return <article className="food-card">
    <div className="food-image">
      <img src={food.imageUrl || '/placeholder-food.svg'} alt={food.name} />
      <button className={`favorite-button ${favorite ? 'active' : ''}`} onClick={() => toggleFavorite(food._id).catch(error => notify(error.message))} title="Món yêu thích"><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button>
      {food.ratingCount > 0 && <span className="rating"><Star size={13} fill="currentColor" /> {food.ratingAverage.toFixed(1)}</span>}
    </div>
    <div className="food-body">
      <small>{food.category?.name}</small>
      <h3>{food.name}</h3>
      <p>{food.description}</p>
      <div className="food-bottom"><strong>{money(food.price)}</strong><button onClick={() => addToCart(food)}><Plus size={18} /> Thêm</button></div>
    </div>
  </article>;
}

