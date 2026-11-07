import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RefProvider } from './contexts/RefContext';
import { TenantProvider } from './contexts/TenantContext';
import TenantPreviewBanner from './components/admin/TenantPreviewBanner';
import { CartProvider } from './contexts/CartContext';
import BrandHead from './components/branding/BrandHead';
import ImpersonationBanner from './components/ImpersonationBanner';

// Layouts
import StoreLayout from './layouts/StoreLayout';
import BackofficeLayout from './layouts/BackofficeLayout';

// Store pages (publicas)
import StoreHome from './pages/store/StoreHome';
import ProductDetails from './pages/store/ProductDetails';
import CategoryPage from './pages/store/CategoryPage';
import SubcategoryPage from './pages/store/SubcategoryPage';
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
import MyConsignmentCardPage from './pages/store/MyConsignmentCardPage';
import SearchPage from './pages/store/SearchPage';
import CompleteEmployeeRegistration from './pages/public/CompleteEmployeeRegistration';

// Auth
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Public pages
import CmsPageView from './pages/store/CmsPageView';
import CustomerReviewPage from './pages/store/CustomerReviewPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Backoffice & Admin (Code Splitting / Lazy Loading p/ performance maxima da loja publica)
const AdminDashboard = React.lazy(() => import('./pages/backoffice/AdminDashboard'));
const AdminProducts = React.lazy(() => import('./pages/backoffice/AdminProducts'));
const AdminProductForm = React.lazy(() => import('./pages/backoffice/AdminProductForm'));
const AdminCategories = React.lazy(() => import('./pages/backoffice/AdminCategories'));
const AdminOrders = React.lazy(() => import('./pages/backoffice/AdminOrders'));
const AdminUsers = React.lazy(() => import('./pages/backoffice/AdminUsers'));
const AdminUserDetails = React.lazy(() => import('./pages/backoffice/AdminUserDetails'));
const AdminSettings = React.lazy(() => import('./pages/backoffice/AdminSettings'));
const AdminNetworks = React.lazy(() => import('./pages/backoffice/AdminNetworks'));
const AdminCandidates = React.lazy(() => import('./pages/backoffice/AdminCandidates'));
const AdminCommissionsReport = React.lazy(() => import('./pages/backoffice/AdminCommissionsReport'));
const AdminCommissionsByGeneration = React.lazy(() => import('./pages/backoffice/AdminCommissionsByGeneration'));
const AdminWithdrawals = React.lazy(() => import('./pages/backoffice/AdminWithdrawals'));
const AdminInvoices = React.lazy(() => import('./pages/backoffice/AdminInvoices'));
const AdminEmails = React.lazy(() => import('./pages/backoffice/AdminEmails'));
const AdminTenants = React.lazy(() => import('./pages/backoffice/AdminTenants'));
const AdminPageBuilder = React.lazy(() => import('./pages/backoffice/AdminPageBuilder'));
const AdminWebhook = React.lazy(() => import('./pages/backoffice/AdminWebhook'));
const AdminGiftCards = React.lazy(() => import('./pages/backoffice/AdminGiftCards'));
const AdminPoints = React.lazy(() => import('./pages/backoffice/AdminPoints'));
const AdminPayments = React.lazy(() => import('./pages/backoffice/AdminPayments'));
const AdminPgCatalog = React.lazy(() => import('./pages/backoffice/AdminPgCatalog'));
const AdminShipping = React.lazy(() => import('./pages/backoffice/AdminShipping'));
const AdminMaxx = React.lazy(() => import('./pages/backoffice/AdminMaxx'));
const AdminMaxxPending = React.lazy(() => import('./pages/backoffice/AdminMaxxPending'));
const AdminIgvd = React.lazy(() => import('./pages/backoffice/AdminIgvd'));
const AdminPDV = React.lazy(() => import('./pages/backoffice/AdminPDV'));
const AdminMultiplierCampaign = React.lazy(() => import('./pages/backoffice/AdminMultiplierCampaign'));
const AdminNetworkSuppression = React.lazy(() => import('./pages/backoffice/AdminNetworkSuppression'));
const AdminCompanies = React.lazy(() => import('./pages/backoffice/AdminCompanies'));
const AdminCompanyForm = React.lazy(() => import('./pages/backoffice/AdminCompanyForm'));
const AdminCompanyBillings = React.lazy(() => import('./pages/backoffice/AdminCompanyBillings'));
const AdminWarrantyBonus = React.lazy(() => import('./pages/backoffice/AdminWarrantyBonus'));
const CompanyLayout = React.lazy(() => import('./layouts/CompanyLayout'));
const CompanyDashboard = React.lazy(() => import('./pages/company/CompanyDashboard'));
const CompanyEmployees = React.lazy(() => import('./pages/company/CompanyEmployees'));
const CompanyContract = React.lazy(() => import('./pages/company/CompanyContract'));
const CompanyReports = React.lazy(() => import('./pages/company/CompanyReports'));
const CompanyMonthlyClosing = React.lazy(() => import('./pages/company/CompanyMonthlyClosing'));
const PropagandistaLayout = React.lazy(() => import('./layouts/PropagandistaLayout'));
const PropagandistaDashboard = React.lazy(() => import('./pages/propagandista/PropagandistaDashboard'));
const PropagandistaCompanies = React.lazy(() => import('./pages/propagandista/PropagandistaCompanies'));
const PropagandistaCompanyCreatePage = React.lazy(() => import('./pages/propagandista/PropagandistaCompanyCreatePage'));
const AdminMelhorEnvio = React.lazy(() => import('./pages/backoffice/AdminMelhorEnvio'));
const AdminOpery = React.lazy(() => import('./pages/backoffice/AdminOpery'));
const OperyDocs = React.lazy(() => import('./pages/OperyDocs'));
const OperyDevMonitor = React.lazy(() => import('./pages/OperyDevMonitor'));
const AdminReferralApproved = React.lazy(() => import('./pages/backoffice/AdminReferralApproved'));
const AdminAppearance = React.lazy(() => import('./pages/backoffice/AdminAppearance'));
const AdminPagesList = React.lazy(() => import('./pages/backoffice/AdminPages').then(m => ({ default: m.AdminPagesList })));
const AdminPageEditor = React.lazy(() => import('./pages/backoffice/AdminPages').then(m => ({ default: m.AdminPageEditor })));
const AdminUserCategories = React.lazy(() => import('./pages/backoffice/AdminUserCategories'));
const AdminCoupons = React.lazy(() => import('./pages/backoffice/AdminCoupons'));
const AdminReferralEnrollments = React.lazy(() => import('./pages/backoffice/AdminReferralEnrollments'));
const AdminMergeUsers = React.lazy(() => import('./pages/backoffice/AdminMergeUsers'));
const AdminRecalcCommissions = React.lazy(() => import('./pages/backoffice/AdminRecalcCommissions'));
const AdminRoles = React.lazy(() => import('./pages/backoffice/AdminRoles'));
const AdminAuditLogs = React.lazy(() => import('./pages/backoffice/AdminAuditLogs'));
const AdminReviews = React.lazy(() => import('./pages/backoffice/AdminReviews'));
const AdminCampaigns = React.lazy(() => import('./pages/backoffice/AdminCampaigns'));

function Guard({ children, requireAuth = false, requireAdmin = false, requireCompanyAdmin = false, requirePropagandista = false }) {
  const { isAuthenticated, isAdmin, loading, user } = useAuth();
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
  if (requireCompanyAdmin) {
    const r = user?.role;
    if (!isAuthenticated) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    if (r !== 'company_admin' && !user?.company_admin_of && !user?.company_id && r !== 'admin' && r !== 'super_admin') return <Navigate to="/" replace />;
  }
  if (requirePropagandista) {
    if (!isAuthenticated) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    const isCompanyAdmin = user?.role === 'company_admin' || Boolean(user?.company_admin_of) || Boolean(user?.company_id);
    if (isCompanyAdmin) return <Navigate to="/empresa" replace />;
    const isProp = user?.role === 'propagandista' || user?.is_propagandista === true || isAdmin;
    if (!isProp) return <Navigate to="/" replace />;
  }
  return children;
}

const LazyFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-[3px] border-brand-main border-t-transparent rounded-full animate-spin" />
  </div>
);

function AppRoutes() {
  return (
    <React.Suspense fallback={<LazyFallback />}>
      <Routes>
      {/* LOJA PÚBLICA */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<StoreHome />} />
        <Route path="/produto/:id" element={<ProductDetails />} />
        <Route path="/categoria/:slug" element={<CategoryPage />} />
        <Route path="/subcategoria/:slug" element={<SubcategoryPage />} />
        <Route path="/produtos" element={<SearchPage />} />
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
        <Route path="/meu-cartao-consignado" element={<Guard requireAuth><MyConsignmentCardPage /></Guard>} />
        <Route path="/meus-pontos" element={<Guard requireAuth><MyPoints /></Guard>} />
        <Route path="/p/:slug" element={<CmsPageView />} />
        <Route path="/avaliar/:orderId" element={<CustomerReviewPage />} />
        <Route path="/avaliar" element={<CustomerReviewPage />} />
      </Route>

      {/* Nota de faturamento: standalone (sem header/footer) para impressão limpa */}
      <Route path="/pedido/:id/nota" element={<Guard requireAuth><InvoicePage /></Guard>} />

      {/* AUTH */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastrar" element={<RegisterPage />} />
      <Route path="/completar-cadastro-convenio" element={<CompleteEmployeeRegistration />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage mode="reset" />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage mode="reset" />} />
      <Route path="/primeiro-acesso" element={<ResetPasswordPage mode="first_access" />} />
      <Route path="/primeiro-acesso-solicitar" element={<ForgotPasswordPage mode="first_access" />} />

      {/* Documentação pública da API Opery */}
      <Route path="/docs/opery" element={<OperyDocs />} />
      <Route path="/opery/monitor" element={<OperyDevMonitor />} />

      {/* BACKOFFICE (ADMIN) */}
      <Route path="/backoffice" element={<Guard requireAuth requireAdmin><BackofficeLayout /></Guard>}>
        <Route index element={<DashboardOrPedidos />} />
        <Route path="produtos" element={<AdminProducts />} />
        <Route path="produtos/novo" element={<AdminProductForm />} />
        <Route path="produtos/:productId" element={<AdminProductForm />} />
        <Route path="categorias" element={<AdminCategories />} />
        <Route path="pedidos" element={<AdminOrders />} />
        <Route path="avaliacoes" element={<AdminReviews />} />
        <Route path="campanhas" element={<AdminCampaigns />} />
        <Route path="pdv" element={<AdminPDV />} />
        <Route path="campanha" element={<AdminMultiplierCampaign />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="usuarios/duplicados" element={<AdminMergeUsers />} />
        <Route path="usuarios/:user_id" element={<AdminUserDetails />} />
        <Route path="categorias-usuarios" element={<AdminUserCategories />} />
        <Route path="cupons" element={<AdminCoupons />} />
        <Route path="redes" element={<AdminNetworks />} />
        <Route path="candidatos" element={<AdminCandidates />} />
        <Route path="adesoes-indicacao" element={<AdminReferralEnrollments />} />
        <Route path="relatorio-comissoes" element={<AdminCommissionsReport />} />
        <Route path="comissoes-por-geracao" element={<AdminCommissionsByGeneration />} />
        <Route path="recalcular-comissoes" element={<AdminRecalcCommissions />} />
        <Route path="cartao" element={<AdminGiftCards />} />
        <Route path="pontos" element={<AdminPoints />} />
        <Route path="pagamentos" element={<AdminPayments />} />
            <Route path="catalogo-pg" element={<AdminPgCatalog />} />
        <Route path="frete" element={<AdminShipping />} />
        <Route path="maxx" element={<AdminMaxx />} />
        <Route path="maxx-pendentes" element={<AdminMaxxPending />} />
        <Route path="supressao-rede" element={<AdminNetworkSuppression />} />
        <Route path="convenio" element={<AdminCompanies />} />
        <Route path="convenio/nova" element={<AdminCompanyForm />} />
        <Route path="convenio/faturamento" element={<AdminCompanyBillings />} />
        <Route path="convenio/:companyId" element={<AdminCompanyForm />} />
        <Route path="bonus-garantia" element={<AdminWarrantyBonus />} />
        <Route path="igvd" element={<AdminIgvd />} />
        <Route path="melhor-envio" element={<AdminMelhorEnvio />} />
        <Route path="opery" element={<AdminOpery />} />
        <Route path="programa-aprovados" element={<AdminReferralApproved />} />
        <Route path="aparencia" element={<AdminAppearance />} />
        <Route path="perfis" element={<AdminRoles />} />
        <Route path="paginas" element={<AdminPagesList />} />
        <Route path="paginas/:id" element={<AdminPageEditor />} />
        <Route path="saques" element={<AdminWithdrawals />} />
        <Route path="faturamento" element={<AdminInvoices />} />
        <Route path="emails" element={<AdminEmails />} />
        <Route path="marcas" element={<AdminTenants />} />
        <Route path="page-builder" element={<AdminPageBuilder />} />
        <Route path="webhook" element={<AdminWebhook />} />
        <Route path="auditoria" element={<AdminAuditLogs />} />
        <Route path="configuracoes" element={<AdminSettings />} />
      </Route>

      {/* PAINEL DA EMPRESA (RH) — role: company_admin */}
      <Route path="/empresa" element={<Guard requireCompanyAdmin><CompanyLayout /></Guard>}>
        <Route index element={<CompanyDashboard />} />
        <Route path="funcionarios" element={<CompanyEmployees />} />
        <Route path="relatorios" element={<CompanyReports />} />
        <Route path="fechamento" element={<CompanyMonthlyClosing />} />
        <Route path="contrato" element={<CompanyContract />} />
      </Route>

      {/* PAINEL PROPAGANDISTA — role: propagandista */}
      <Route path="/propagandista" element={<Guard requirePropagandista><PropagandistaLayout /></Guard>}>
        <Route index element={<PropagandistaDashboard />} />
        <Route path="comissoes" element={<PropagandistaDashboard />} />
        <Route path="empresas" element={<PropagandistaCompanies />} />
        <Route path="empresas/nova" element={<PropagandistaCompanyCreatePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        <AuthProvider>
          <RefProvider>
            <CartProvider>
              <BrandHead />
              <ImpersonationBanner />
              <TenantPreviewBanner />
              <AppRoutes />
              <Toaster richColors position="top-right" />
            </CartProvider>
          </RefProvider>
        </AuthProvider>
      </TenantProvider>
    </BrowserRouter>
  );
}

// Iter 48: Estoque nao ve dashboard — cai direto em Pedidos
function DashboardOrPedidos() {
  const { can } = useAuth();
  if (can?.viewDashboard === false) return <Navigate to="/backoffice/pedidos" replace />;
  return <AdminDashboard />;
}
