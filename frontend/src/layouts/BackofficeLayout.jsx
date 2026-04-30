import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, FolderTree, ShoppingBag, Users, LogOut, Store, Menu,
  Network, Award, FileText, Settings, Wallet, Receipt, Mail, Webhook, CreditCard,
  Star, Truck, Palette, FileEdit, Repeat, ChevronDown, Tag, Ticket, UserCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/branding/BrandLogo';

// ====== Menu agrupado em seções ======
const NAV_GROUPS = [
  {
    key: 'principal',
    label: 'Principal',
    items: [
      { to: '/backoffice', icon: LayoutDashboard, label: 'Dashboard', end: true, testId: 'nav-dashboard' },
      { to: '/backoffice/produtos', icon: Package, label: 'Produtos', testId: 'nav-products' },
      { to: '/backoffice/categorias', icon: FolderTree, label: 'Categorias', testId: 'nav-categories' },
    ],
  },
  {
    key: 'vendas',
    label: 'Vendas',
    items: [
      { to: '/backoffice/pedidos', icon: ShoppingBag, label: 'Pedidos', testId: 'nav-orders' },
      { to: '/backoffice/cupons', icon: Ticket, label: 'Cupons', testId: 'nav-coupons' },
      { to: '/backoffice/faturamento', icon: Receipt, label: 'Faturamento', testId: 'nav-invoices' },
      { to: '/backoffice/pagamentos', icon: Wallet, label: 'Pagamentos', testId: 'nav-payments' },
      { to: '/backoffice/frete', icon: Truck, label: 'Frete', testId: 'nav-shipping' },
    ],
  },
  {
    key: 'mmn',
    label: 'MMN / Comissões',
    items: [
      { to: '/backoffice/redes', icon: Network, label: 'Redes MMN', testId: 'nav-networks' },
      { to: '/backoffice/candidatos', icon: Award, label: 'Candidatos', testId: 'nav-candidates' },
      { to: '/backoffice/adesoes-indicacao', icon: UserCheck, label: 'Adesões pendentes', testId: 'nav-referral-enrollments' },
      { to: '/backoffice/relatorio-comissoes', icon: FileText, label: 'Rel. comissões', testId: 'nav-commissions-report' },
      { to: '/backoffice/pontos', icon: Star, label: 'Rel. pontos', testId: 'nav-points' },
      { to: '/backoffice/cartao', icon: CreditCard, label: 'Cartão Benefícios', testId: 'nav-card' },
      { to: '/backoffice/maxx', icon: Repeat, label: 'Maxx MMN', testId: 'nav-maxx' },
    ],
  },
  {
    key: 'conteudo',
    label: 'Conteúdo',
    items: [
      { to: '/backoffice/aparencia', icon: Palette, label: 'Aparência', testId: 'nav-appearance' },
      { to: '/backoffice/paginas', icon: FileEdit, label: 'Páginas (CMS)', testId: 'nav-pages' },
    ],
  },
  {
    key: 'comunicacao',
    label: 'Comunicação',
    items: [
      { to: '/backoffice/emails', icon: Mail, label: 'Emails', testId: 'nav-emails' },
      { to: '/backoffice/webhook', icon: Webhook, label: 'API Sync', testId: 'nav-webhook' },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    items: [
      { to: '/backoffice/usuarios', icon: Users, label: 'Usuários', testId: 'nav-users' },
      { to: '/backoffice/categorias-usuarios', icon: Tag, label: 'Cat. de usuários', testId: 'nav-user-categories' },
      { to: '/backoffice/configuracoes', icon: Settings, label: 'Configurações', testId: 'nav-settings' },
    ],
  },
];

export default function BackofficeLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Estado: quais grupos estão colapsados (default = todos abertos)
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_nav_collapsed') || '{}'); }
    catch { return {}; }
  });
  const toggleGroup = (key) => {
    const next = { ...collapsed, [key]: !collapsed[key] };
    setCollapsed(next);
    localStorage.setItem('admin_nav_collapsed', JSON.stringify(next));
  };

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg-secondary flex" data-testid="backoffice-layout">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-txt-primary text-white flex flex-col transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header (logo) - fixo no topo */}
        <div className="p-5 border-b border-white/10 flex-shrink-0">
          <Link to="/backoffice" className="flex items-center gap-2">
            <BrandLogo
              slot="admin_sidebar"
              variant="dark"
              textClassName="font-heading font-black text-base leading-none text-white"
            />
          </Link>
          <div className="text-[11px] text-white/60 mt-1 ml-1">Painel Admin</div>
        </div>

        {/* Nav - SCROLLÁVEL */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1 admin-nav-scroll">
          {NAV_GROUPS.map(group => {
            const isCollapsed = !!collapsed[group.key];
            return (
              <div key={group.key} className="pb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition"
                  data-testid={`nav-group-${group.key}`}
                >
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-1">
                    {group.items.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileOpen(false)}
                        data-testid={item.testId}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition ${
                            isActive
                              ? 'bg-brand-main text-white shadow-sm'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer - fixo no rodapé */}
        <div className="p-3 border-t border-white/10 space-y-1 flex-shrink-0">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-white/70 hover:bg-white/10 hover:text-white transition"
            data-testid="go-to-store"
          >
            <Store className="w-4 h-4" /> Ver loja
          </Link>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-white/70 hover:bg-white/10 hover:text-white transition"
            data-testid="admin-logout"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
          <div className="pt-1 px-3 text-[10px] text-white/40 truncate">{user?.email}</div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-border px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-bg-secondary rounded-lg" data-testid="mobile-menu-btn">
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo slot="admin_topbar" variant="light" textClassName="font-heading font-black" />
          <div className="w-9" />
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
