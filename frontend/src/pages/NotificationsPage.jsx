import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';

export default function NotificationsPage() {
  const { user, setUnreadNotifications } = useApp();
  const [items, setItems] = useState([]);
  const load = () => api('/api/notifications').then(data => { setItems(data.notifications); setUnreadNotifications(data.unread); });
  useEffect(() => { if (user) load(); }, [user]);
  if (!user) return <Navigate to="/login" replace />;
  const markAll = async () => { await api('/api/notifications/read-all', { method: 'PATCH' }); await load(); };
  const markOne = async id => { await api(`/api/notifications/${id}/read`, { method: 'PATCH' }); await load(); };
  return <section className="page narrow">
    <div className="page-title"><div><span className="eyebrow">Cập nhật mới</span><h1>Thông báo</h1></div><button className="secondary-button" onClick={markAll}><CheckCheck size={17}/> Đọc tất cả</button></div>
    <div className="notification-list">{items.length ? items.map(item => <article key={item._id} className={`notification-item ${item.isRead ? '' : 'unread'}`} onClick={() => !item.isRead && markOne(item._id)}>
      <Bell size={20}/><div><h3>{item.title}</h3><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small>{item.link && <Link to={item.link}>Xem chi tiết</Link>}</div>
    </article>) : <div className="empty">Chưa có thông báo.</div>}</div>
  </section>;
}

