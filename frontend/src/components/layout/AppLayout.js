import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import { Menu, ArrowLeft } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';

const LOGO_URL = 'https://static.prod-images.emergentagent.com/jobs/ac7e11bd-2d3b-4351-a0cb-75f5d21dc8a6/images/11999c45dfa606ad3f30f54326fa63e71a49f9d047fe241b470a9da4e5771ede.png';

export default function AppLayout({ children, title, subtitle, showBack = false }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isSubPage = showBack || location.pathname.split('/').length > 2;

  return (
    <div className="min-h-screen bg-bg-secondary font-body">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-sidebar min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-8 h-14 lg:h-16">
            <div className="flex items-center gap-3">
              {isSubPage ? (
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-md hover:bg-bg-secondary" data-testid="back-btn">
                  <ArrowLeft className="w-5 h-5 text-txt-secondary" />
                </button>
              ) : (
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-md hover:bg-bg-secondary" data-testid="mobile-menu-btn">
                  <Menu className="w-5 h-5 text-txt-secondary" />
                </button>
              )}
              <div className="lg:hidden flex items-center gap-2">
                <img src={LOGO_URL} alt="OxxPharma" className="h-6" />
              </div>
              {title && (
                <div className="hidden lg:block">
                  <h1 className="font-heading font-bold text-lg text-txt-primary tracking-tight">{title}</h1>
                  {subtitle && <p className="text-xs text-txt-secondary">{subtitle}</p>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-brand-main flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {title && (
              <div className="lg:hidden mb-4">
                <h1 className="font-heading font-bold text-xl text-txt-primary tracking-tight">{title}</h1>
                {subtitle && <p className="text-xs text-txt-secondary mt-0.5">{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, trend, trendUp, color = 'blue', className }) {
  const colors = {
    blue: 'border-l-brand-main',
    green: 'border-l-accent-green',
    amber: 'border-l-amber-500',
    red: 'border-l-accent-red',
    purple: 'border-l-violet-500',
  };
  const iconColors = {
    blue: 'text-brand-main',
    green: 'text-accent-green',
    amber: 'text-amber-500',
    red: 'text-accent-red',
    purple: 'text-violet-500',
  };
  return (
    <div className={cn(
      "bg-white border border-border rounded-md p-5 border-l-4 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200",
      colors[color], className
    )} data-testid={`stat-${label?.replace(/\s/g, '-').toLowerCase()}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-txt-secondary uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-heading font-bold text-txt-primary mt-1">{value}</p>
          {trend && (
            <p className={cn("text-xs font-medium mt-1.5", trendUp ? "text-accent-green" : "text-accent-red")}>
              {trendUp ? '+' : ''}{trend}
            </p>
          )}
        </div>
        {Icon && <Icon className={cn("w-5 h-5", iconColors[color])} strokeWidth={1.5} />}
      </div>
    </div>
  );
}

export function DashCard({ title, subtitle, action, children, className, noPadding }) {
  return (
    <div className={cn("bg-white border border-border rounded-md overflow-hidden", className)}>
      {(title || action) && (
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-heading font-semibold text-sm text-txt-primary">{title}</h3>
            {subtitle && <p className="text-xs text-txt-secondary mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
}
