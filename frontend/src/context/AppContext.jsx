import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState('');

  const notify = message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const refreshCart = async () => {
    const data = await api('/api/cart');
    setCart(data.items);
  };

  useEffect(() => {
    refreshCart().catch(() => {});
    if (localStorage.getItem('token')) {
      api('/api/auth/me').then(data => setUser(data.user)).catch(() => localStorage.removeItem('token'));
    }
  }, []);

  const login = async credentials => {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    await refreshCart();
    notify(`Xin chào ${data.user.fullName}`);
  };

  const register = async payload => {
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    notify('Đăng ký thành công');
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('token');
    setUser(null);
    await refreshCart();
  };

  const addToCart = async food => {
    const existing = cart.find(item => item.foodId === food._id);
    const data = await api(`/api/cart/items/${food._id}`, {
      method: 'PUT', body: JSON.stringify({ quantity: (existing?.quantity || 0) + 1, note: existing?.note || '' })
    });
    setCart(data.items);
    notify(`Đã thêm ${food.name}`);
  };

  const updateCart = async (foodId, quantity) => {
    if (quantity < 1) {
      const data = await api(`/api/cart/items/${foodId}`, { method: 'DELETE' });
      return setCart(data.items);
    }
    const current = cart.find(item => item.foodId === foodId);
    const data = await api(`/api/cart/items/${foodId}`, {
      method: 'PUT', body: JSON.stringify({ quantity, note: current?.note || '' })
    });
    setCart(data.items);
  };

  const value = useMemo(() => ({
    user, cart, toast, login, register, logout, addToCart, updateCart, refreshCart, notify
  }), [user, cart, toast]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);

