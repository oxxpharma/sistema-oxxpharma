import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Wallet, Users, ShoppingBag, UserCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BottomNav() {
  const { accessLevel } = useAuth();
  const location = useLocation();

  const items = accessLevel <= 1
    ? [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Users, label: 'Usuarios', path: '/users' },
        { icon: ShoppingBag, label: 'Pedidos', path: '/orders' },
        { icon: Wallet, label: 'Saques', path: '/withdrawals' },
        { icon: UserCircle, label: 'Perfil', path: '/profile' },
      ]
    : [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Wallet, label: 'Carteira', path: '/wallet' },
        { icon: ShoppingBag, label: 'Pedidos', path: '/orders' },
        { icon: UserCircle, label: 'Perfil', path: '/profile' },
      ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border">
      <div className="flex items-center justify-around h-14" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {items.map(item => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-all",
                isActive ? "text-brand-main" : "text-txt-secondary"
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
