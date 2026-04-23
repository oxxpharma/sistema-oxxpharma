import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RefProvider } from './contexts/RefContext';
import { CartProvider } from './contexts/CartContext';

// Layouts
import StoreLayout from './layouts/StoreLayout';
import BackofficeLayout from './layouts/BackofficeLayout';

// Store pages (publicas)
import StoreHome from './pages/store/StoreHome';
import ProductDetails from './pages/store/ProductDetails';
import CartPage from './pages/store/CartPage';
import CheckoutPage from './pages/store/CheckoutPage';
import OrderDetails from './pages/store/OrderDetails';
import MyOrders from './pages/store/MyOrders';
import MyAddresses from './pages/store/MyAddresses';
import MyReferral from './pages/store/MyReferral';
import MyAccount from './pages/store/MyAccount';
import SearchPage from './pages/store/SearchPage';

// Auth
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Backoffice
import AdminDashboard from './pages/backoffice/AdminDashboard';
import AdminProducts from './pages/backoffice/AdminProducts';
import AdminCategories from './pages/backoffice/AdminCategories';
import AdminOrders from './pages/backoffice/AdminOrders';
import AdminUsers from './pages/backoffice/AdminUsers';

function Guard({ children, requireAuth = false, requireAdmin = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-brand-main border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* LOJA PÚBLICA */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<StoreHome />} />
        <Route path="/produto/:id" element={<ProductDetails />} />
        <Route path="/buscar" element={<SearchPage />} />
        <Route path="/carrinho" element={<CartPage />} />
        <Route path="/checkout" element={<Guard requireAuth><CheckoutPage /></Guard>} />
        <Route path="/pedido/:id" element={<Guard requireAuth><OrderDetails /></Guard>} />
        <Route path="/meus-pedidos" element={<Guard requireAuth><MyOrders /></Guard>} />
        <Route path="/meus-enderecos" element={<Guard requireAuth><MyAddresses /></Guard>} />
        <Route path="/indique-ganhe" element={<Guard requireAuth><MyReferral /></Guard>} />
        <Route path="/minha-conta" element={<Guard requireAuth><MyAccount /></Guard>} />
      </Route>

      {/* AUTH */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastrar" element={<RegisterPage />} />

      {/* BACKOFFICE (ADMIN) */}
      <Route path="/backoffice" element={<Guard requireAuth requireAdmin><BackofficeLayout /></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="produtos" element={<AdminProducts />} />
        <Route path="categorias" element={<AdminCategories />} />
        <Route path="pedidos" element={<AdminOrders />} />
        <Route path="usuarios" element={<AdminUsers />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RefProvider>
          <CartProvider>
            <AppRoutes />
            <Toaster richColors position="top-right" />
          </CartProvider>
        </RefProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
