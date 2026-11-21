import { ChefHat, ClipboardList, LogIn, LogOut, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Layout({ children }) {
  const { user, cart, logout, toast } = useApp();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  return <>
    <header className="topbar">
      <NavLink className="brand" to="/"><span><ChefHat size={24} /></span>Bếp Nhà</NavLink>
      <nav>
        <NavLink to="/"><Sparkles size={17} /> Thực đơn</NavLink>
        {user && <NavLink to="/orders"><ClipboardList size={17} /> Đơn của tôi</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin"><UserRound size={17} /> Quản trị</NavLink>}
      </nav>
      <div className="header-actions">
        <NavLink className="cart-link" to="/cart"><ShoppingBag size={20} /><b>{count}</b></NavLink>
        {user
          ? <button className="icon-button" onClick={logout} title="Đăng xuất"><span>{user.fullName}</span><LogOut size={18} /></button>
          : <NavLink className="login-link" to="/login"><LogIn size={18} /> Đăng nhập</NavLink>}
      </div>
    </header>
    <main>{children}</main>
    <footer><ChefHat size={20} /><b>Bếp Nhà</b><span>Website đặt món sử dụng MongoDB · Redis · Neo4j</span></footer>
    {toast && <div className="toast">{toast}</div>}
  </>;
}

