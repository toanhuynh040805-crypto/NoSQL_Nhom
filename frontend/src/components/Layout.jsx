import { Bell, CalendarDays, ChefHat, ClipboardList, CookingPot, Heart, LayoutDashboard, LogIn, LogOut, ShoppingBag, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Layout({ children }) {
  const { user, cart, logout, toast, unreadNotifications } = useApp();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  return <>
    <header className="topbar">
      <NavLink className="brand" to="/"><span><ChefHat size={24} /></span>Bếp Nhà</NavLink>
      <nav>
        <NavLink to="/"><Sparkles size={17} /> Thực đơn</NavLink>
        {user?.role === 'customer' && <NavLink to="/reservations"><CalendarDays size={17} /> Đặt bàn</NavLink>}
        {user?.role === 'customer' && <NavLink to="/orders"><ClipboardList size={17} /> Đơn của tôi</NavLink>}
        {user?.role === 'customer' && <NavLink to="/favorites"><Heart size={17} /> Yêu thích</NavLink>}
        {['admin', 'staff', 'cashier'].includes(user?.role) && <NavLink to="/operations"><LayoutDashboard size={17} /> Vận hành</NavLink>}
        {['admin', 'kitchen'].includes(user?.role) && <NavLink to="/kitchen"><CookingPot size={17} /> Bếp</NavLink>}
      </nav>
      <div className="header-actions">
        {user && <NavLink className="cart-link notification-link" to="/notifications"><Bell size={19} />{unreadNotifications > 0 && <b>{unreadNotifications}</b>}</NavLink>}
        <NavLink className="cart-link" to="/cart"><ShoppingBag size={20} /><b>{count}</b></NavLink>
        {user
          ? <><NavLink className="profile-link" to="/profile">{user.fullName}</NavLink><button className="icon-button logout-only" onClick={logout} title="Đăng xuất"><LogOut size={18} /></button></>
          : <NavLink className="login-link" to="/login"><LogIn size={18} /> Đăng nhập</NavLink>}
      </div>
    </header>
    <main>{children}</main>
    <footer><ChefHat size={20} /><b>Bếp Nhà</b><span>Website đặt món sử dụng MongoDB · Redis · Neo4j</span></footer>
    {toast && <div className="toast">{toast}</div>}
  </>;
}

