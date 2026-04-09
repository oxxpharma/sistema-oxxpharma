import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, ACCESS_LEVELS } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Package, Wallet, Settings,
  Network, LogOut, UserCircle, BarChart3, DollarSign,
  ChevronRight, Store, ShoppingBag, Link2, Building2,
  MapPin, Globe2, ArrowUpCircle
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

const LOGO_URL = 'https://static.prod-images.emergentagent.com/jobs/ac7e11bd-2d3b-4351-a0cb-75f5d21dc8a6/images/11999c45dfa606ad3f30f54326fa63e71a49f9d047fe241b470a9da4e5771ede.png';

const getMenuItems = (accessLevel) => {
  const items = [];

  // Admin (0) e Nacional (1)
  if (accessLevel <= 1) {
    items.push({ section: 'Gestao' });
    items.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' });
    items.push({ icon: Users, label: 'Usuarios', path: '/users' });
    items.push({ icon: Network, label: 'Rede', path: '/network' });
    items.push({ icon: Building2, label: 'Franquias', path: '/franchises' });
    items.push({ section: 'Comercial' });
    items.push({ icon: Package, label: 'Produtos', path: '/products' });
    items.push({ icon: ShoppingBag, label: 'Pedidos', path: '/orders' });
    items.push({ section: 'Financeiro' });
    items.push({ icon: DollarSign, label: 'Comissoes', path: '/commissions' });
    items.push({ icon: Wallet, label: 'Saques', path: '/withdrawals' });
    items.push({ icon: BarChart3, label: 'Relatorios', path: '/reports' });
    items.push({ icon: ArrowUpCircle, label: 'Upgrades', path: '/upgrade-requests' });
  }

  // Admin (0) only
  if (accessLevel === 0) {
    items.push({ section: 'Sistema' });
    items.push({ icon: Settings, label: 'Configuracoes', path: '/settings' });
  }

  // Estadual (2)
  if (accessLevel === 2) {
    items.push({ section: 'Meu Estado' });
    items.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' });
    items.push({ icon: MapPin, label: 'Minhas Regionais', path: '/users' });
    items.push({ icon: Network, label: 'Rede', path: '/network' });
    items.push({ section: 'Financeiro' });
    items.push({ icon: DollarSign, label: 'Comissoes', path: '/commissions' });
    items.push({ icon: Wallet, label: 'Carteira', path: '/wallet' });
  }

  // Regional (3)
  if (accessLevel === 3) {
    items.push({ section: 'Minha Regiao' });
    items.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' });
    items.push({ icon: Store, label: 'Minhas Unidades', path: '/users' });
    items.push({ icon: Network, label: 'Rede', path: '/network' });
    items.push({ section: 'Financeiro' });
    items.push({ icon: DollarSign, label: 'Comissoes', path: '/commissions' });
    items.push({ icon: Wallet, label: 'Carteira', path: '/wallet' });
  }

  // Cidade (4)
  if (accessLevel === 4) {
    items.push({ section: 'Minha Unidade' });
    items.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' });
    items.push({ icon: Users, label: 'Indicadores', path: '/users' });
    items.push({ icon: ShoppingBag, label: 'Vendas', path: '/orders' });
    items.push({ icon: Link2, label: 'Link de Indicacao', path: '/referral' });
    items.push({ section: 'Financeiro' });
    items.push({ icon: DollarSign, label: 'Comissoes', path: '/commissions' });
    items.push({ icon: Wallet, label: 'Carteira', path: '/wallet' });
  }

  // Indicador (5) / Unidade Indicadora (6)
  if (accessLevel >= 5) {
    items.push({ section: 'Principal' });
    items.push({ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' });
    items.push({ icon: Link2, label: 'Meu Link', path: '/referral' });
    items.push({ icon: ShoppingBag, label: 'Meus Pedidos', path: '/orders' });
    items.push({ icon: Wallet, label: 'Carteira', path: '/wallet' });
    if (accessLevel === 5) {
      items.push({ icon: ArrowUpCircle, label: 'Upgrade', path: '/upgrade' });
    }
  }

  return items;
};

export default function Sidebar({ isOpen, onClose }) {
  const { user, accessLevel, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const menuItems = getMenuItems(accessLevel);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-full w-sidebar bg-white z-50 flex flex-col border-r border-border transition-transform duration-200",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border">
          <img src={LOGO_URL} alt="OxxPharma" className="h-8" />
          <span className="ml-2 font-heading font-bold text-lg text-txt-primary tracking-tight">OxxPharma</span>
        </div>

        {/* User Info */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-brand-main flex items-center justify-center text-white font-heading font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-txt-primary truncate">{user?.name || 'Usuario'}</p>
              <p className="text-xs text-txt-secondary">{ACCESS_LEVELS[accessLevel]?.name || 'Usuario'}</p>
            </div>
          </div>
          {user?.available_balance !== undefined && (
            <div className="mt-3 px-3 py-2 bg-bg-secondary rounded-md">
              <p className="text-xs text-txt-secondary">Saldo</p>
              <p className="text-sm font-bold text-brand-main">{formatCurrency(user.available_balance)}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3" data-testid="sidebar-nav">
          {menuItems.map((item, idx) => {
            if (item.section) {
              return (
                <div key={`s-${idx}`} className="pt-5 pb-1.5 px-2 first:pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-txt-secondary/60">
                    {item.section}
                  </span>
                </div>
              );
            }
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                data-testid={`nav-${item.path.replace(/\//g, '')}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-brand-main text-white"
                    : "text-txt-secondary hover:bg-bg-secondary hover:text-txt-primary"
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-1">
          <Link
            to="/store"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-txt-secondary hover:bg-bg-secondary transition-all"
          >
            <Store className="w-[18px] h-[18px]" strokeWidth={1.8} />
            <span>Loja</span>
          </Link>
          <Link
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-txt-secondary hover:bg-bg-secondary transition-all"
          >
            <UserCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />
            <span>Perfil</span>
          </Link>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-accent-red hover:bg-red-50 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
