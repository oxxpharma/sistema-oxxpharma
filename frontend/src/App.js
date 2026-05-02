import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RefProvider } from './contexts/RefContext';
import { CartProvider } from './contexts/CartContext';
import BrandHead from './components/branding/BrandHead';

// Layouts
import StoreLayout from './layouts/StoreLayout';
import BackofficeLayout from './layouts/BackofficeLayout';

// Store pages (publicas)
import StoreHome from './pages/store/StoreHome';
import ProductDetails from './pages/store/ProductDetails';
import CartPage from './pages/store/CartPage';
import CheckoutPage from './pages/store/CheckoutPage';
import OrderDetails from './pages/store/OrderDetails';
import InvoicePage from './pages/store/InvoicePage';
import MyOrders from './pages/store/MyOrders';
import MyAddresses from './pages/store/MyAddresses';
import MyReferral from './pages/store/MyReferral';
import MyNetwork from './pages/store/MyNetwork';
import MyWithdrawals from './pages/store/MyWithdrawals';
import MyAccount from './pages/store/MyAccount';
import MyPoints from './pages/store/MyPoints';
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
import AdminUserDetails from './pages/backoffice/AdminUserDetails';
import AdminSettings from './pages/backoffice/AdminSettings';
import AdminNetworks from './pages/backoffice/AdminNetworks';
import AdminCandidates from './pages/backoffice/AdminCandidates';
import AdminCommissionsReport from './pages/backoffice/AdminCommissionsReport';
import AdminWithdrawals from './pages/backoffice/AdminWithdrawals';
import AdminInvoices from './pages/backoffice/AdminInvoices';
import AdminEmails from './pages/backoffice/AdminEmails';
import AdminWebhook from './pages/backoffice/AdminWebhook';
import AdminGiftCards from './pages/backoffice/AdminGiftCards';
import AdminPoints from './pages/backoffice/AdminPoints';
import AdminPayments from './pages/backoffice/AdminPayments';
import AdminShipping from './pages/backoffice/AdminShipping';
import AdminMaxx from './pages/backoffice/AdminMaxx';
import AdminMaxxPending from './pages/backoffice/AdminMaxxPending';
import AdminMelhorEnvio from './pages/backoffice/AdminMelhorEnvio';
import AdminReferralApproved from './pages/backoffice/AdminReferralApproved';
import AdminAppearance from './pages/backoffice/AdminAppearance';
import { AdminPagesList, AdminPageEditor } from './pages/backoffice/AdminPages';
import CmsPageView from './pages/store/CmsPageView';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import AdminUserCategories from './pages/backoffice/AdminUserCategories';
import AdminCoupons from './pages/backoffice/AdminCoupons';
import AdminReferralEnrollments from './pages/backoffice/AdminReferralEnrollments';
import AdminMergeUsers from './pages/backoffice/AdminMergeUsers';
import AdminRecalcCommissions from './pages/backoffice/AdminRecalcCommissions';

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
        <Route path="/minha-rede" element={<Guard requireAuth><MyNetwork /></Guard>} />
        <Route path="/meus-saques" element={<Guard requireAuth><MyWithdrawals /></Guard>} />
        <Route path="/minha-conta" element={<Guard requireAuth><MyAccount /></Guard>} />
        <Route path="/meus-pontos" element={<Guard requireAuth><MyPoints /></Guard>} />
        <Route path="/p/:slug" element={<CmsPageView />} />
      </Route>

      {/* Nota de faturamento: standalone (sem header/footer) para impressão limpa */}
      <Route path="/pedido/:id/nota" element={<Guard requireAuth><InvoicePage /></Guard>} />

      {/* AUTH */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastrar" element={<RegisterPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage mode="reset" />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage mode="reset" />} />
      <Route path="/primeiro-acesso" element={<ResetPasswordPage mode="first_access" />} />
      <Route path="/primeiro-acesso-solicitar" element={<ForgotPasswordPage mode="first_access" />} />

      {/* BACKOFFICE (ADMIN) */}
      <Route path="/backoffice" element={<Guard requireAuth requireAdmin><BackofficeLayout /></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="produtos" element={<AdminProducts />} />
        <Route path="categorias" element={<AdminCategories />} />
        <Route path="pedidos" element={<AdminOrders />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="usuarios/duplicados" element={<AdminMergeUsers />} />
        <Route path="usuarios/:user_id" element={<AdminUserDetails />} />
        <Route path="categorias-usuarios" element={<AdminUserCategories />} />
        <Route path="cupons" element={<AdminCoupons />} />
        <Route path="redes" element={<AdminNetworks />} />
        <Route path="candidatos" element={<AdminCandidates />} />
        <Route path="adesoes-indicacao" element={<AdminReferralEnrollments />} />
        <Route path="relatorio-comissoes" element={<AdminCommissionsReport />} />
        <Route path="recalcular-comissoes" element={<AdminRecalcCommissions />} />
        <Route path="cartao" element={<AdminGiftCards />} />
        <Route path="pontos" element={<AdminPoints />} />
        <Route path="pagamentos" element={<AdminPayments />} />
        <Route path="frete" element={<AdminShipping />} />
        <Route path="maxx" element={<AdminMaxx />} />
        <Route path="maxx-pendentes" element={<AdminMaxxPending />} />
        <Route path="melhor-envio" element={<AdminMelhorEnvio />} />
        <Route path="programa-aprovados" element={<AdminReferralApproved />} />
        <Route path="aparencia" element={<AdminAppearance />} />
        <Route path="paginas" element={<AdminPagesList />} />
        <Route path="paginas/:id" element={<AdminPageEditor />} />
        <Route path="saques" element={<AdminWithdrawals />} />
        <Route path="faturamento" element={<AdminInvoices />} />
        <Route path="emails" element={<AdminEmails />} />
        <Route path="webhook" element={<AdminWebhook />} />
        <Route path="configuracoes" element={<AdminSettings />} />
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
            <BrandHead />
            <AppRoutes />
            <Toaster richColors position="top-right" />
          </CartProvider>
        </RefProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
