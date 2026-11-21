import { KeyRound, Save, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';

export default function ProfilePage() {
  const { user, notify } = useApp();
  const [profile, setProfile] = useState({ fullName: '', phone: '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  useEffect(() => { if (user) setProfile({ fullName: user.fullName || '', phone: user.phone || '' }); }, [user]);
  if (!user) return <Navigate to="/login?next=/profile" replace />;
  const saveProfile = async event => {
    event.preventDefault();
    try { await api('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }); notify('Đã cập nhật hồ sơ'); }
    catch (error) { notify(error.message); }
  };
  const changePassword = async event => {
    event.preventDefault();
    try { await api('/api/profile/password', { method: 'PUT', body: JSON.stringify(password) }); setPassword({ currentPassword: '', newPassword: '' }); notify('Đã đổi mật khẩu'); }
    catch (error) { notify(error.message); }
  };
  return <section className="page narrow">
    <div className="page-title"><div><span className="eyebrow">Tài khoản</span><h1>Hồ sơ của tôi</h1></div></div>
    <div className="profile-grid">
      <form className="panel-form" onSubmit={saveProfile}><div className="panel-heading"><UserRound/><h2>Thông tin cá nhân</h2></div>
        <label>Email<input value={user.email} disabled /></label>
        <label>Họ và tên<input required value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })}/></label>
        <label>Số điện thoại<input required value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}/></label>
        <div className="loyalty-box"><span>Điểm thành viên</span><strong>{user.loyaltyPoints || 0} điểm</strong></div>
        <button className="primary-button"><Save size={17}/> Lưu thông tin</button>
      </form>
      <form className="panel-form" onSubmit={changePassword}><div className="panel-heading"><KeyRound/><h2>Đổi mật khẩu</h2></div>
        <label>Mật khẩu hiện tại<input type="password" minLength="6" required value={password.currentPassword} onChange={e => setPassword({ ...password, currentPassword: e.target.value })}/></label>
        <label>Mật khẩu mới<input type="password" minLength="6" required value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })}/></label>
        <button className="primary-button">Cập nhật mật khẩu</button>
      </form>
    </div>
  </section>;
}

