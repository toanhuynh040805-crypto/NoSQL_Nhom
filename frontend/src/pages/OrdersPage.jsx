import { Clock3, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api, money } from '../lib/api.js';

const labels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chế biến', ready: 'Sẵn sàng phục vụ', completed: 'Hoàn thành', cancelled: 'Đã hủy' };

export default function OrdersPage() {
  const { user } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (user) api('/api/orders/mine').then(data => setOrders(data.orders)).finally(() => setLoading(false)); }, [user]);
  if (!user) return <Navigate to="/login?next=/orders" replace/>;
  return <section className="page narrow">
    <div className="page-title"><div><span className="eyebrow">Theo dõi</span><h1>Đơn của tôi</h1></div></div>
    {loading ? <div className="empty">Đang tải...</div> : !orders.length ? <div className="empty-cart"><PackageCheck size={58}/><h2>Chưa có đơn nào</h2><Link className="primary-button" to="/">Chọn món ngay</Link></div> : <div className="orders-list">
      {orders.map(order => <article className="order-card" key={order._id}>
        <div className="order-header"><div><small>Mã đơn</small><h3>{order.orderCode}</h3></div><span className={`status ${order.status}`}><Clock3 size={14}/>{labels[order.status]}</span></div>
        <ul>{order.items.map((item, index) => <li key={index}><span>{item.quantity} × {item.name}</span><b>{money(item.price * item.quantity)}</b></li>)}</ul>
        <div className="order-footer"><span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span><strong>{money(order.subtotal)}</strong></div>
      </article>)}
    </div>}
  </section>;
}

