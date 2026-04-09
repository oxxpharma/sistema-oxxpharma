import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import NetworkPage from './pages/NetworkPage';
import SettingsPage from './pages/SettingsPage';
import CommissionsPage from './pages/CommissionsPage';
import WalletPage from './pages/WalletPage';
import OrdersPage from './pages/OrdersPage';
import WithdrawalsPage from './pages/WithdrawalsAdminPage';
import ProfilePage from './pages/ProfilePage';
import StorePage from './pages/StorePage';
import ReferralPage from './pages/ReferralPage';
import FranchisesPage from './pages/FranchisesPage';
import ReportsPage from './pages/ReportsPage';

function ProtectedRoute({ children, maxLevel = 99 }) {
  const { isAuthenticated, loading, accessLevel } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (accessLevel > maxLevel) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/store" element={<StorePage />} />

      {/* All Authenticated */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
      <Route path="/commissions" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/referral" element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
      <Route path="/network" element={<ProtectedRoute maxLevel={4}><NetworkPage /></ProtectedRoute>} />

      {/* Admin + Nacional */}
      <Route path="/users" element={<ProtectedRoute maxLevel={4}><UsersPage /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute maxLevel={1}><ProductsPage /></ProtectedRoute>} />
      <Route path="/withdrawals" element={<ProtectedRoute maxLevel={1}><WithdrawalsPage /></ProtectedRoute>} />
      <Route path="/franchises" element={<ProtectedRoute maxLevel={1}><FranchisesPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute maxLevel={1}><ReportsPage /></ProtectedRoute>} />

      {/* Admin Only */}
      <Route path="/settings" element={<ProtectedRoute maxLevel={0}><SettingsPage /></ProtectedRoute>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
