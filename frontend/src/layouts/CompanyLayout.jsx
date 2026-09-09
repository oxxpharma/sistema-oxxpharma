import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Building2, Users, FileText, LogOut, ClipboardList, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/branding/BrandLogo';

const NAV = [
  { to: '/empresa', end: true, icon: Building2, label: 'Painel', testId: 'nav-company-dashboard' },
  { to: '/empresa/funcionarios', icon: Users, label: 'Funcionários', testId: 'nav-company-employees' },
  { to: '/empresa/relatorios', icon: BarChart3, label: 'Relatórios', testId: 'nav-company-reports' },
  { to: '/empresa/fechamento', icon: ClipboardList, label: 'Fechamento mensal', testId: 'nav-company-closing' },
  { to: '/empresa/contrato', icon: FileText, label: 'Contrato', testId: 'nav-company-contract' },
];

export default function CompanyLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-bg-secondary flex" data-testid="company-layout">
      <aside className="w-64 bg-white border-r border-border p-4 flex flex-col shrink-0 hidden md:flex">
        <BrandLogo className="mb-3" />
        <div className="text-[10px] uppercase font-bold text-brand-main mb-3 tracking-wider">Painel Empresa</div>
        <nav className="flex-1 space-y-1">
          {NAV.map(it => (
            <NavLink key={it.to} to={it.to} end={it.end} data-testid={it.testId}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-brand-main text-white font-bold' : 'text-txt-primary hover:bg-bg-secondary'}`}>
              <it.icon className="w-4 h-4" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs text-txt-secondary truncate mb-2">{user?.email}</div>
          <button onClick={async () => { await logout(); nav('/'); }} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700" data-testid="company-logout">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
