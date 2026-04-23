import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Users, Package, ShoppingBag, DollarSign, Clock, TrendingUp, Loader2, ArrowRight } from 'lucide-react';

const STATUS = {
  pending: { label: 'Aguardando', variant: 'warning' },
  paid: { label: 'Pago', variant: 'success' },
  shipped: { label: 'Enviado', variant: 'info' },
  delivered: { label: 'Entregue', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'error' },
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('/api/admin/dashboard');
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!data) return null;

  const stats = [
    { icon: DollarSign, label: 'Receita total', value: formatCurrency(data.total_revenue), color: 'emerald' },
    { icon: TrendingUp, label: 'Receita do mês', value: formatCurrency(data.month_revenue), color: 'brand' },
    { icon: ShoppingBag, label: 'Pedidos totais', value: data.total_orders, color: 'blue' },
    { icon: Clock, label: 'Pendentes', value: data.pending_orders, color: 'amber' },
    { icon: Users, label: 'Clientes', value: data.total_users, color: 'purple' },
    { icon: Package, label: 'Produtos ativos', value: data.total_products, color: 'pink' },
  ];

  const colorBg = {
    emerald: 'bg-emerald-100 text-emerald-600',
    brand: 'bg-brand-light text-brand-main',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
    pink: 'bg-pink-100 text-pink-600',
  };

  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-1">Dashboard</h1>
      <p className="text-sm text-txt-secondary mb-6">Visão geral da operação</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colorBg[s.color]}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-heading font-black">{s.value}</div>
            <div className="text-xs text-txt-secondary mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg mb-4">Pedidos por status</h2>
          <div className="space-y-2">
            {Object.entries(data.orders_by_status).map(([status, count]) => {
              const s = STATUS[status] || { label: status, variant: 'default' };
              return (
                <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary">
                  <Badge variant={s.variant}>{s.label}</Badge>
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}
            {Object.keys(data.orders_by_status).length === 0 && (
              <p className="text-sm text-txt-secondary text-center py-6">Sem pedidos ainda.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-black text-lg">Pedidos recentes</h2>
            <Link to="/backoffice/pedidos" className="text-xs text-brand-main font-semibold flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {data.recent_orders.length === 0 && (
              <p className="text-sm text-txt-secondary text-center py-6">Sem pedidos ainda.</p>
            )}
            {data.recent_orders.map(o => {
              const s = STATUS[o.order_status] || STATUS.pending;
              return (
                <Link to={`/backoffice/pedidos/${o.order_id}`} key={o.order_id} className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary hover:bg-gray-100 transition">
                  <div className="min-w-0">
                    <div className="text-xs font-mono">#{o.order_id.slice(-8).toUpperCase()}</div>
                    <div className="text-sm font-semibold truncate">{o.customer_name}</div>
                    <div className="text-[11px] text-txt-secondary">{formatDateTime(o.created_at)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-sm">{formatCurrency(o.total)}</div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
