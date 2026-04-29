import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Package, FolderTree, ShoppingBag, Users, LogOut, Store, Menu, X, Network, Award, FileText, Settings, Wallet, Receipt, Mail, Webhook, CreditCard, Star, Truck, Palette, FileEdit, Repeat } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/backoffice', icon: LayoutDashboard, label: 'Dashboard', end: true, testId: 'nav-dashboard' },
  { to: '/backoffice/produtos', icon: Package, label: 'Produtos', testId: 'nav-products' },
  { to: '/backoffice/categorias', icon: FolderTree, label: 'Categorias', testId: 'nav-categories' },
  { to: '/backoffice/pedidos', icon: ShoppingBag, label: 'Pedidos', testId: 'nav-orders' },
  { to: '/backoffice/faturamento', icon: Receipt, label: 'Faturamento', testId: 'nav-invoices' },
  { to: '/backoffice/redes', icon: Network, label: 'Redes MMN', testId: 'nav-networks' },
  { to: '/backoffice/candidatos', icon: Award, label: 'Candidatos', testId: 'nav-candidates' },
  { to: '/backoffice/relatorio-comissoes', icon: FileText, label: 'Relatório comissões', testId: 'nav-commissions-report' },
  { to: '/backoffice/pontos', icon: Star, label: 'Relatório pontos', testId: 'nav-points' },
  { to: '/backoffice/pagamentos', icon: Wallet, label: 'Pagamentos (MP)', testId: 'nav-payments' },
  { to: '/backoffice/frete', icon: Truck, label: 'Frete (Correios)', testId: 'nav-shipping' },
  { to: '/backoffice/cartao', icon: CreditCard, label: 'Cartão Benefícios', testId: 'nav-card' },
  { to: '/backoffice/maxx', icon: Repeat, label: 'Maxx MMN (sync)', testId: 'nav-maxx' },
  { to: '/backoffice/aparencia', icon: Palette, label: 'Aparência', testId: 'nav-appearance' },
  { to: '/backoffice/paginas', icon: FileEdit, label: 'Páginas (CMS)', testId: 'nav-pages' },
  { to: '/backoffice/emails', icon: Mail, label: 'Emails', testId: 'nav-emails' },
  { to: '/backoffice/webhook', icon: Webhook, label: 'API Sync', testId: 'nav-webhook' },
  { to: '/backoffice/usuarios', icon: Users, label: 'Usuários', testId: 'nav-users' },
  { to: '/backoffice/configuracoes', icon: Settings, label: 'Configurações', testId: 'nav-settings' },
];

export default function BackofficeLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg-secondary flex" data-testid="backoffice-layout">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-txt-primary text-white flex flex-col transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-white/10">
          <Link to="/backoffice" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-brand-main flex items-center justify-center">
              <span className="text-white font-heading font-black text-lg">O</span>
            </div>
            <div>
              <div className="font-heading font-black text-lg leading-none">OxxPharma</div>
              <div className="text-[11px] text-white/60 mt-0.5">Painel Admin</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              data-testid={item.testId}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-brand-main text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition" data-testid="go-to-store">
            <Store className="w-4 h-4" /> Ver loja
          </Link>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition" data-testid="admin-logout">
            <LogOut className="w-4 h-4" /> Sair
          </button>
          <div className="pt-2 px-3 text-[11px] text-white/40 truncate">{user?.email}</div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-border px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-bg-secondary rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-black">OxxPharma Admin</span>
          <div className="w-9" />
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
