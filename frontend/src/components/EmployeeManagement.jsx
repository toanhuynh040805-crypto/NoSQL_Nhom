import { useMemo, useState } from 'react';
import { BriefcaseBusiness, Search, UserPlus, UserRoundCheck, UserRoundX, X } from 'lucide-react';
import { api } from '../lib/api.js';

const employeeRoles = {
  admin: 'Quản lý', staff: 'Phục vụ', kitchen: 'Bếp', cashier: 'Thu ngân'
};
const newEmployee = () => ({
  mode: 'create', fullName: '', email: '', phone: '', password: '', role: 'staff'
});

export default function EmployeeManagement({ data, user, action }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const employees = data.employees || [];
  const summary = data.summary || {};
  const filtered = useMemo(() => employees.filter(item => {
    const term = search.trim().toLocaleLowerCase('vi-VN');
    const haystack = (item.fullName + ' ' + item.email + ' ' + (item.phone || '')).toLocaleLowerCase('vi-VN');
    return (!term || haystack.includes(term)) &&
      (roleFilter === 'all' || item.role === roleFilter);
  }), [employees, search, roleFilter]);

  const save = async event => {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    try {
      const payload = {
        fullName: editor.fullName.trim(), email: editor.email.trim(),
        phone: editor.phone.trim(), role: editor.role
      };
      const creating = editor.mode === 'create';
      if (creating) payload.password = editor.password;
      const url = creating ? '/api/admin/employees' : '/api/admin/employees/' + editor._id;
      const ok = await action(() => api(url, {
        method: creating ? 'POST' : 'PATCH', body: JSON.stringify(payload)
      }), creating ? 'Đã tạo tài khoản nhân viên' : 'Đã cập nhật hồ sơ nhân viên');
      if (ok) setEditor(null);
    } finally { setSaving(false); }
  };

  const toggle = async item => {
    if (item._id === user?.id) return;
    if (item.isActive && !window.confirm('Khóa tài khoản nhân viên ' + item.fullName + '?')) return;
    setWorkingId(item._id);
    try {
      await action(() => api('/api/admin/employees/' + item._id, {
        method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive })
      }), item.isActive ? 'Đã khóa tài khoản nhân viên' : 'Đã mở khóa tài khoản nhân viên');
    } finally { setWorkingId(null); }
  };

  return <div className="directory-page">
    <p className="directory-description">Quản lý tài khoản làm việc của bộ phận phục vụ, bếp, thu ngân và quản lý. Chỉ quản trị viên được tạo, chỉnh sửa hoặc khóa nhân viên.</p>
    <div className="directory-stats">
      <article><BriefcaseBusiness/><span>Tổng nhân sự</span><strong>{summary.total ?? employees.length}</strong></article>
      <article><UserRoundCheck/><span>Đang hoạt động</span><strong>{summary.active ?? 0}</strong></article>
      <article><UserRoundX/><span>Đã khóa</span><strong>{summary.locked ?? 0}</strong></article>
    </div>
    <div className="directory-toolbar">
      <label className="directory-search"><Search size={17}/><input type="search" placeholder="Tìm nhân viên theo tên, email hoặc SĐT" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <label className="directory-select-label">Bộ phận
        <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
          <option value="all">Tất cả bộ phận</option>
          {Object.entries(employeeRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="button" className="primary-button compact-button" onClick={() => setEditor(newEmployee())}><UserPlus size={17}/> Thêm nhân viên</button>
    </div>
    {editor && <form className="directory-editor" onSubmit={save}>
      <div className="directory-editor-head"><h3>{editor.mode === 'create' ? 'Tạo tài khoản nhân viên' : 'Chỉnh sửa nhân viên'}</h3>
        <button type="button" className="secondary-button" onClick={() => setEditor(null)} aria-label="Đóng biểu mẫu"><X size={17}/></button>
      </div>
      <div className="directory-form-grid">
        <label>Họ và tên<input required minLength={2} maxLength={80} value={editor.fullName} onChange={e => setEditor(old => ({ ...old, fullName: e.target.value }))}/></label>
        <label>Email đăng nhập<input required type="email" value={editor.email} onChange={e => setEditor(old => ({ ...old, email: e.target.value }))}/></label>
        <label>Số điện thoại<input type="tel" maxLength={20} value={editor.phone} onChange={e => setEditor(old => ({ ...old, phone: e.target.value }))}/></label>
        <label>Bộ phận / phân quyền<select value={editor.role} disabled={editor._id === user?.id} onChange={e => setEditor(old => ({ ...old, role: e.target.value }))}>
          {Object.entries(employeeRoles).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></label>
        {editor.mode === 'create' && <label>Mật khẩu ban đầu (ít nhất 8 ký tự)
          <input type="password" autoComplete="new-password" required minLength={8} maxLength={128}
            value={editor.password} onChange={e => setEditor(old => ({ ...old, password: e.target.value }))}/>
        </label>}
      </div>
      <p className="directory-hint">Tài khoản mới chỉ đăng nhập được bằng email và mật khẩu đã đặt. Mật khẩu được mã hóa trên backend; không hiển thị trong danh sách.</p>
      <div className="directory-editor-actions">
        <button type="button" className="secondary-button" onClick={() => setEditor(null)}>Hủy</button>
        <button type="submit" className="primary-button compact-button" disabled={saving}>{saving ? 'Đang lưu...' : (editor.mode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi')}</button>
      </div>
    </form>}
    <div className="admin-table-wrap directory-table"><table><thead><tr>
      <th>Nhân viên</th><th>Liên hệ</th><th>Bộ phận</th><th>Ngày tạo</th><th>Trạng thái</th><th>Thao tác</th>
    </tr></thead><tbody>{filtered.map(item => <tr key={item._id}>
      <td><b>{item.fullName}</b>{item._id === user?.id && <small>Tài khoản của bạn</small>}</td>
      <td>{item.email}<small>{item.phone || 'Chưa cập nhật SĐT'}</small></td>
      <td><span className="directory-role">{employeeRoles[item.role] || item.role}</span></td>
      <td>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
      <td><span className={'directory-status ' + (item.isActive ? 'enabled' : 'disabled')}>{item.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td>
      <td><div className="directory-actions">
        <button type="button" className="table-action" onClick={() => setEditor({ mode: 'edit', ...item })}>Sửa</button>
        <button type="button" className={'toggle-button ' + (item.isActive ? 'active' : '')}
          disabled={item._id === user?.id || workingId === item._id} onClick={() => toggle(item)}>
          {item.isActive ? 'Khóa' : 'Mở khóa'}</button>
      </div></td>
    </tr>)}</tbody></table>
      {filtered.length === 0 && <div className="directory-empty">Không tìm thấy nhân viên phù hợp.</div>}
    </div>
  </div>;
}
