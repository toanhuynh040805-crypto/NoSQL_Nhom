const API_URL = import.meta.env.VITE_API_URL || '';

function cartId() {
  let id = localStorage.getItem('cart_id');
  if (!id) {
    id = crypto.randomUUID().replaceAll('-', '');
    localStorage.setItem('cart_id', id);
  }
  return id;
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'x-cart-id': cartId(),
    ...options.headers
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể kết nối máy chủ');
  return data;
}

export const money = value => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0
}).format(value);

