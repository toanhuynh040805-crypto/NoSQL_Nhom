import { CircleDollarSign, Clock3, CookingPot, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api, money } from '../lib/api.js';

export default function AdminPage() {
  const { user, notify } = useApp();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const load = () => Promise.all([api('/api/admin/dashboard'), api('/api/admin/orders')]).then(([a, b]) => { setStats(a); setOrders(b.orders); });
  useEffect(() => { if (user?.role === 'admin') load(); }, [user]);
  if (user?.role !== 'admin') return <Navigate to="/" replace/>;
  const changeStatus = async (id, status) => {
    try { await api(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); notify('Đã cập nhật trạng thái'); }
    catch (error) { notify(error.message); }
  };
  return <section className="page admin-page">
    <div className="page-title"><div><span className="eyebrow">Điều hành</span><h1>Tổng quan nhà hàng</h1></div></div>
    {stats && <div className="stat-grid">
      <div><UsersRound/><span>Khách hàng</span><strong>{stats.users}</strong></div>
      <div><CookingPot/><span>Món ăn</span><strong>{stats.foods}</strong></div>
      <div><Clock3/><span>Đơn đang xử lý</span><strong>{stats.pendingOrders}</strong></div>
      <div><CircleDollarSign/><span>Doanh thu hôm nay</span><strong>{money(stats.today.revenue)}</strong></div>
    </div>}
    <div className="admin-table-wrap"><h2>Đơn hàng gần đây</h2><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Món</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>
      {orders.map(order => <tr key={order._id}><td><b>{order.orderCode}</b></td><td>{order.customer?.fullName}<small>{order.customer?.phone}</small></td><td>{order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</td><td>{money(order.subtotal)}</td><td><select value={order.status} disabled={['completed','cancelled'].includes(order.status)} onChange={e => changeStatus(order._id, e.target.value)}><option value="pending">Chờ xác nhận</option><option value="confirmed">Đã xác nhận</option><option value="preparing">Đang chế biến</option><option value="ready">Sẵn sàng</option><option value="completed">Hoàn thành</option><option value="cancelled">Hủy đơn</option></select></td></tr>)}
    </tbody></table></div>
  </section>;
}

