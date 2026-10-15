import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { Users, DollarSign, LogOut, LayoutDashboard, Menu, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/branding/BrandLogo';

const NAV = [
  { to: '/propagandista', end: true, icon: LayoutDashboard, label: 'Painel' },
  { to: '/propagandista/comissoes', icon: DollarSign, label: 'Comissões' },
  { to: '/propagandista/empresas', icon: Users, label: 'Minhas empresas' },
];

export default function PropagandistaLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-secondary flex flex-col md:flex-row" data-testid="propagandista-layout">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-border p-4 flex-col shrink-0 hidden md:flex sticky top-0 h-screen">
        <BrandLogo className="mb-2" />
        <div className="text-[10px] uppercase font-bold text-brand-main mb-3 tracking-wider">Propagandista</div>

        <Link
          to="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:text-brand-main hover:bg-orange-50 border border-border hover:border-brand-main/30 transition mb-3"
          data-testid="propagandista-sidebar-back-to-site"
        >
          <ArrowLeft className="w-4 h-4 text-brand-main" />
          <span>Voltar ao Site</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {NAV.map(it => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-brand-main text-white font-bold' : 'text-txt-primary hover:bg-bg-secondary'}`}
            >
              <it.icon className="w-4 h-4" /> {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 pt-4 border-t border-border space-y-1">
          <div className="text-xs text-txt-secondary truncate px-3 py-1">{user?.email}</div>
          <button
            onClick={async () => { await logout(); nav('/'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition"
            data-testid="propagandista-logout"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar com Botão Voltar ao Site */}
        <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded-lg border border-border text-gray-700 hover:bg-gray-100 transition"
              data-testid="propagandista-mobile-menu-toggle"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-heading font-bold text-sm text-txt-primary">Painel Propagandista</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-txt-secondary">
            <span>Área Comercial</span>
            <span>/</span>
            <span className="font-semibold text-txt-primary">Propagandista</span>
          </div>

          <Link
            to="/"
            className="flex items-center gap-2 px-3.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-brand-main border border-orange-200 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm"
            data-testid="propagandista-topbar-back-to-site"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Site</span>
          </Link>
        </header>

        {/* Menu Mobile gaveta */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-border p-4 space-y-2 animate-in slide-in-from-top duration-150">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-brand-main bg-orange-50 mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Site
            </Link>
            <nav className="space-y-1">
              {NAV.map(it => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-brand-main text-white font-bold' : 'text-txt-primary hover:bg-bg-secondary'}`}
                >
                  <it.icon className="w-4 h-4" /> {it.label}
                </NavLink>
              ))}
            </nav>
            <div className="pt-3 border-t border-border">
              <button
                onClick={async () => { await logout(); nav('/'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 font-medium"
              >
                <LogOut className="w-4 h-4" /> Sair da conta
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
