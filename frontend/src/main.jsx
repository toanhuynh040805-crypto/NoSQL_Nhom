import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { AppProvider } from './context/AppContext.jsx';
import AdminPage from './pages/AdminPage.jsx';
import CartPage from './pages/CartPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AppProvider><Layout><Routes>
    <Route path="/" element={<MenuPage/>}/>
    <Route path="/cart" element={<CartPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/orders" element={<OrdersPage/>}/>
    <Route path="/admin" element={<AdminPage/>}/>
  </Routes></Layout></AppProvider></BrowserRouter></React.StrictMode>
);

