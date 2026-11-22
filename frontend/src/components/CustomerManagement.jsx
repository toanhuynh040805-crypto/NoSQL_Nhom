import { useMemo, useState } from 'react';
import { Search, UserRoundCheck, UserRoundX, UsersRound } from 'lucide-react';
import { api, money } from '../lib/api.js';

export default function CustomerManagement({ data, action }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [workingId, setWorkingId] = useState(null);
  const customers = data.customers || [];
  const summary = data.summary || {};
  const filtered = useMemo(() => customers.filter(item => {
    const term = search.trim().toLocaleLowerCase('vi-VN');
    const match = (item.fullName + ' ' + item.email + ' ' + (item.phone || '')).toLocaleLowerCase('vi-VN');
    return (!term || match.includes(term)) &&
      (status === 'all' || (status === 'active' ? item.isActive : !item.isActive));
  }), [customers, search, status]);

  const toggle = async item => {
    if (item.isActive && !window.confirm('Khóa tài khoản khách hàng ' + item.fullName + '?')) return;
    setWorkingId(item._id);
    try {
      await action(() => api('/api/admin/customers/' + item._id, {
        method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive })
      }), item.isActive ? 'Đã khóa tài khoản khách hàng' : 'Đã mở khóa tài khoản khách hàng');
    } finally { setWorkingId(null); }
  };

  return <div className="directory-page">
    <p className="directory-description">Khách hàng đã đăng ký, lịch sử gọi món và đặt bàn. Dữ liệu đơn hàng, điểm tích lũy và đánh giá được giữ nguyên khi khóa tài khoản.</p>
    <div className="directory-stats">
      <article><UsersRound/><span>Tổng khách hàng</span><strong>{summary.total ?? customers.length}</strong></article>
      <article><UserRoundCheck/><span>Đang hoạt động</span><strong>{summary.active ?? 0}</strong></article>
      <article><UserRoundX/><span>Đã khóa</span><strong>{summary.locked ?? 0}</strong></article>
    </div>
    <div className="directory-toolbar">
      <label className="directory-search"><Search size={17}/><input type="search" placeholder="Tìm tên, email hoặc số điện thoại khách" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <label className="directory-select-label">Trạng thái
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">Tất cả</option><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option>
        </select>
      </label>
    </div>
    <div className="admin-table-wrap directory-table"><table><thead><tr>
      <th>Khách hàng</th><th>Liên hệ</th><th>Đơn hàng</th><th>Đặt bàn</th><th>Đã thanh toán</th><th>Điểm tích lũy</th><th>Trạng thái</th>
    </tr></thead><tbody>{filtered.map(item => <tr key={item._id}>
      <td><b>{item.fullName}</b><small>Tham gia: {new Date(item.createdAt).toLocaleDateString('vi-VN')}</small></td>
      <td>{item.email}<small>{item.phone || 'Chưa cập nhật SĐT'}</small></td>
      <td><strong>{item.orderCount || 0}</strong></td>
      <td><strong>{item.reservationCount || 0}</strong></td>
      <td><strong>{money(item.paidAmount || 0)}</strong></td>
      <td><strong>{item.loyaltyPoints || 0}</strong></td>
      <td><button type="button" className={'toggle-button ' + (item.isActive ? 'active' : '')}
        onClick={() => toggle(item)} disabled={workingId === item._id}>
        {item.isActive ? 'Hoạt động' : 'Đã khóa'}
      </button></td>
    </tr>)}</tbody></table>
      {filtered.length === 0 && <div className="directory-empty">Không tìm thấy khách hàng phù hợp.</div>}
    </div>
  </div>;
}
