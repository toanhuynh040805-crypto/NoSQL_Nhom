import { CalendarDays, MapPin, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';

const labels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', seated: 'Đã nhận bàn', completed: 'Hoàn thành', cancelled: 'Đã hủy', 'no-show': 'Không đến' };

export default function ReservationsPage() {
  const { user, notify } = useApp();
  const [reservations, setReservations] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({ reservedAt: '', guestCount: 2, phone: '', areaPreference: '', note: '' });
  const load = () => Promise.all([api('/api/reservations/mine'), api('/api/tables')]).then(([r, t]) => {
    setReservations(r.reservations); setAreas([...new Set(t.tables.map(table => table.area))]);
  });
  useEffect(() => { if (user) { setForm(current => ({ ...current, phone: user.phone || '' })); load(); } }, [user]);
  if (!user) return <Navigate to="/login?next=/reservations" replace />;
  const submit = async event => {
    event.preventDefault();
    try { await api('/api/reservations', { method: 'POST', body: JSON.stringify(form) }); notify('Đã gửi yêu cầu đặt bàn'); setForm({ ...form, reservedAt: '', note: '' }); await load(); }
    catch (error) { notify(error.message); }
  };
  const cancel = async id => { if (!confirm('Bạn muốn hủy yêu cầu đặt bàn này?')) return; await api(`/api/reservations/${id}/cancel`, { method: 'PATCH' }); notify('Đã hủy đặt bàn'); await load(); };
  return <section className="page">
    <div className="page-title"><div><span className="eyebrow">Giữ chỗ trước</span><h1>Đặt bàn tại quán</h1></div></div>
    <div className="reservation-grid">
      <form className="panel-form reservation-form" onSubmit={submit}><div className="panel-heading"><CalendarDays/><h2>Thông tin đặt bàn</h2></div>
        <label>Ngày và giờ đến<input type="datetime-local" required value={form.reservedAt} onChange={e => setForm({ ...form, reservedAt: e.target.value })}/></label>
        <label>Số khách<input type="number" min="1" max="50" required value={form.guestCount} onChange={e => setForm({ ...form, guestCount: Number(e.target.value) })}/></label>
        <label>Số điện thoại<input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></label>
        <label>Khu vực mong muốn<select value={form.areaPreference} onChange={e => setForm({ ...form, areaPreference: e.target.value })}><option value="">Quán tự sắp xếp</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label>
        <label>Ghi chú<textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Ghế trẻ em, sinh nhật..."/></label>
        <button className="primary-button">Gửi yêu cầu đặt bàn</button>
      </form>
      <div className="reservation-list"><h2>Lịch đặt bàn của tôi</h2>{reservations.length ? reservations.map(item => <article className="reservation-card" key={item._id}>
        <div><b>{item.reservationCode}</b><span className={`status ${item.status}`}>{labels[item.status]}</span></div>
        <p><CalendarDays size={16}/>{new Date(item.reservedAt).toLocaleString('vi-VN')}</p><p><UsersRound size={16}/>{item.guestCount} khách</p><p><MapPin size={16}/>{item.table?.name || item.areaPreference || 'Chưa xếp bàn'}</p>
        {['pending', 'confirmed'].includes(item.status) && <button className="danger-link" onClick={() => cancel(item._id)}>Hủy đặt bàn</button>}
      </article>) : <div className="empty">Bạn chưa có lịch đặt bàn.</div>}</div>
    </div>
  </section>;
}

