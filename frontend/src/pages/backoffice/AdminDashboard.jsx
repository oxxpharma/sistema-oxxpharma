import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import {
  Users, ShoppingBag, DollarSign, TrendingUp, TrendingDown,
  Loader2, ArrowRight, Trophy, Award, Receipt, CircleDollarSign,
} from 'lucide-react';

const STATUS = {
  pending: { label: 'Aguardando', color: 'bg-amber-500' },
  paid: { label: 'Pago', color: 'bg-emerald-500' },
  shipped: { label: 'Enviado', color: 'bg-sky-500' },
  delivered: { label: 'Entregue', color: 'bg-emerald-600' },
  cancelled: { label: 'Cancelado', color: 'bg-rose-500' },
};

const NETWORK_BADGE = {
  network_1: { label: 'Equipe 1', variant: 'brand' },
  network_2: { label: 'Equipe 2', variant: 'success' },
  customer: { label: 'Cliente', variant: 'default' },
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const load = async (s = start, e = end) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (s) q.set('start', s);
      if (e) q.set('end', e);
      const url = q.toString() ? `/api/admin/dashboard?${q}` : '/api/admin/dashboard';
      const d = await api.get(url);
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load('', ''); /* eslint-disable-next-line */ }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-main" />
      </div>
    );
  }
  if (!data) return null;

  const wc = data.weekly_comparison || {};
  const hasFilter = !!(start || end);
  const clearFilter = () => { setStart(''); setEnd(''); load('', ''); };
  const setQuickRange = (days) => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - (days - 1));
    const e = today.toISOString().slice(0, 10);
    const s = from.toISOString().slice(0, 10);
    setStart(s); setEnd(e); load(s, e);
  };

  return (
    <div data-testid="admin-dashboard" className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary">Dashboard</h1>
          <p className="text-sm text-txt-secondary">
            {hasFilter
              ? `Período: ${start || '...'} até ${end || '...'}`
              : 'Visão geral da operação · últimos 7 dias vs. semana anterior'}
          </p>
        </div>
        {/* Iter 41: filtro de range de data */}
        <div className="bg-white border border-border rounded-lg p-3 flex flex-wrap items-end gap-2" data-testid="dashboard-period-filter">
          <div>
            <label className="text-[10px] uppercase font-bold text-txt-secondary block mb-1">De</label>
            <input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="h-9 px-2 text-sm bg-bg-secondary border border-border rounded-md"
              data-testid="filter-start"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-txt-secondary block mb-1">Até</label>
            <input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="h-9 px-2 text-sm bg-bg-secondary border border-border rounded-md"
              data-testid="filter-end"
            />
          </div>
          <button
            type="button"
            onClick={() => load(start, end)}
            className="h-9 px-3 bg-brand-main text-white rounded-md text-xs font-bold hover:opacity-90"
            data-testid="filter-apply"
          >Aplicar</button>
          <div className="flex gap-1 ml-2">
            <button type="button" onClick={() => setQuickRange(7)} className="h-9 px-2 text-xs font-semibold bg-bg-secondary rounded-md hover:bg-border" data-testid="filter-7d">7d</button>
            <button type="button" onClick={() => setQuickRange(30)} className="h-9 px-2 text-xs font-semibold bg-bg-secondary rounded-md hover:bg-border" data-testid="filter-30d">30d</button>
            <button type="button" onClick={() => setQuickRange(90)} className="h-9 px-2 text-xs font-semibold bg-bg-secondary rounded-md hover:bg-border" data-testid="filter-90d">90d</button>
          </div>
          {hasFilter && (
            <button type="button" onClick={clearFilter} className="h-9 px-2 text-xs font-semibold text-txt-secondary hover:text-brand-main" data-testid="filter-clear">Limpar</button>
          )}
        </div>
      </div>

      {/* Linha 1: 4 KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBig
          icon={DollarSign}
          label="Faturamento total"
          value={formatCurrency(data.total_revenue)}
          deltaPct={wc.revenue_pct}
          deltaLabel="vs. semana anterior"
          accent
          testId="kpi-revenue"
        />
        <KpiBig
          icon={ShoppingBag}
          label="Pedidos totais"
          value={data.total_orders.toLocaleString('pt-BR')}
          deltaPct={wc.orders_pct}
          deltaLabel="vs. semana anterior"
          testId="kpi-orders"
        />
        <KpiBig
          icon={Receipt}
          label="Ticket médio"
          value={formatCurrency(data.avg_ticket || 0)}
          hint={`${data.paid_orders || 0} pedidos pagos`}
          testId="kpi-ticket"
        />
        <KpiBig
          icon={Users}
          label="Clientes ativos"
          value={data.total_users.toLocaleString('pt-BR')}
          hint={`${data.total_products} produtos ativos`}
          testId="kpi-users"
        />
      </div>

      {/* Linha 2: Receita por dia (chart) + Status pie */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-border p-5 lg:col-span-2" data-testid="revenue-chart-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-heading font-black text-lg">Faturamento (últimos 30 dias)</h2>
              <p className="text-xs text-txt-secondary">Receita líquida dos pedidos pagos por dia</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-txt-secondary">Esta semana</div>
              <div className="font-heading font-black text-lg">{formatCurrency(wc.current_revenue || 0)}</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={data.revenue_by_day} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => v.slice(8, 10) + '/' + v.slice(5, 7)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                />
                <Tooltip
                  formatter={(val, name) => name === 'revenue' ? [formatCurrency(val), 'Receita'] : [val, 'Pedidos']}
                  labelFormatter={(v) => v}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#f97316' }}
                  fill="url(#revGrad)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <StatusBreakdownCard items={data.orders_by_status} />
      </div>

      {/* Linha 3: Top compradores + Top indicadores */}
      <div className="grid lg:grid-cols-2 gap-4">
        <TopBuyersCard items={data.top_buyers || []} />
        <TopAffiliatesCard items={data.top_affiliates || []} />
      </div>

      {/* Linha 4: Comissões consolidadas + Pedidos recentes */}
      <div className="grid lg:grid-cols-3 gap-4">
        <CommissionsCard summary={data.commissions_summary || {}} />
        <RecentOrdersCard items={data.recent_orders || []} className="lg:col-span-2" />
      </div>
    </div>
  );
}

/* ============ Componentes ============ */

function KpiBig({ icon: Icon, label, value, deltaPct, deltaLabel, hint, accent = false, testId }) {
  const trendUp = (deltaPct ?? 0) > 0;
  const trendDown = (deltaPct ?? 0) < 0;
  return (
    <div
      className={`rounded-2xl p-5 border transition ${
        accent
          ? 'bg-gradient-to-br from-brand-main to-brand-hover text-white border-transparent shadow-lg shadow-brand-main/20'
          : 'bg-white border-border'
      }`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent ? 'bg-white/20' : 'bg-brand-light text-brand-main'}`}>
          <Icon className="w-5 h-5" />
        </div>
        {deltaPct != null && (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
              accent
                ? 'bg-white/20 text-white'
                : trendUp
                ? 'bg-emerald-50 text-emerald-700'
                : trendDown
                ? 'bg-rose-50 text-rose-700'
                : 'bg-bg-secondary text-txt-secondary'
            }`}
          >
            {trendUp ? <TrendingUp className="w-3 h-3" /> : trendDown ? <TrendingDown className="w-3 h-3" /> : null}
            {deltaPct > 0 ? '+' : ''}{deltaPct?.toFixed(2)}%
          </span>
        )}
      </div>
      <div className={`text-2xl lg:text-3xl font-heading font-black tracking-tight ${accent ? '' : 'text-txt-primary'}`}>
        {value}
      </div>
      <div className={`text-xs mt-1 ${accent ? 'text-white/80' : 'text-txt-secondary'}`}>
        {label}
        {hint && <span className="ml-1 opacity-70">· {hint}</span>}
        {deltaLabel && deltaPct != null && <span className="ml-1 opacity-70">· {deltaLabel}</span>}
      </div>
    </div>
  );
}

function StatusBreakdownCard({ items }) {
  const total = items.reduce((s, i) => s + (i.count || 0), 0) || 1;
  const palette = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#10b981', '#ef4444', '#0ea5e9'];
  const pieData = items.map((it, i) => ({
    name: STATUS[it.status]?.label || it.status,
    value: it.count,
    color: STATUS[it.status]?.color?.replace('bg-', '') ? null : palette[i % palette.length],
    raw: it,
  }));
  return (
    <div className="bg-white rounded-2xl border border-border p-5" data-testid="status-breakdown-card">
      <h2 className="font-heading font-black text-lg mb-1">Pedidos por status</h2>
      <p className="text-xs text-txt-secondary mb-3">Distribuição e valor por status</p>
      {items.length === 0 ? (
        <div className="text-sm text-txt-secondary py-8 text-center">Sem pedidos ainda.</div>
      ) : (
        <>
          <div style={{ width: '100%', height: 140 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} pedidos`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 mt-2">
            {items.map((it, i) => {
              const pct = Math.round((it.count / total) * 100);
              const color = palette[i % palette.length];
              return (
                <li key={it.status} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="font-semibold">{STATUS[it.status]?.label || it.status}</span>
                      <span className="text-xs text-txt-secondary">({it.count})</span>
                    </div>
                    <span className="text-xs font-bold">{formatCurrency(it.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function TopBuyersCard({ items }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5" data-testid="top-buyers-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="font-heading font-black text-lg">Top 10 compradores</h2>
        </div>
        <span className="text-xs text-txt-secondary">por valor acumulado pago</span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-txt-secondary py-8 text-center">Sem compras pagas ainda.</div>
      ) : (
        <ol className="divide-y divide-border">
          {items.map((b, i) => {
            const net = NETWORK_BADGE[b.network_type] || NETWORK_BADGE.customer;
            return (
              <li key={b.user_id} className="flex items-center gap-3 py-2.5" data-testid={`top-buyer-${i + 1}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-heading font-black text-xs shrink-0 ${
                  i === 0 ? 'bg-amber-400 text-white'
                  : i === 1 ? 'bg-slate-300 text-slate-700'
                  : i === 2 ? 'bg-amber-700 text-white'
                  : 'bg-bg-secondary text-txt-secondary'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/backoffice/usuarios/${b.user_id}`} className="font-semibold text-sm hover:text-brand-main truncate block">
                    {b.name}
                  </Link>
                  <div className="text-[11px] text-txt-secondary truncate">{b.email}</div>
                </div>
                <Badge variant={net.variant} className="hidden sm:inline-flex">{net.label}</Badge>
                <div className="text-right shrink-0">
                  <div className="font-heading font-black text-sm">{formatCurrency(b.total)}</div>
                  <div className="text-[11px] text-txt-secondary">{b.orders} {b.orders === 1 ? 'pedido' : 'pedidos'}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function TopAffiliatesCard({ items }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5" data-testid="top-affiliates-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-brand-main" />
          <h2 className="font-heading font-black text-lg">Top 10 indicadores</h2>
        </div>
        <span className="text-xs text-txt-secondary" title="Soma do subtotal dos pedidos comprados pela primeira pessoa indicada por este usuário (link próprio)">
          por vendas diretas no link
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-txt-secondary py-8 text-center">Sem vendas diretas pelo link de indicação ainda.</div>
      ) : (
        <ol className="divide-y divide-border">
          {items.map((a, i) => {
            const net = NETWORK_BADGE[a.network_type] || NETWORK_BADGE.customer;
            return (
              <li key={a.user_id} className="flex items-center gap-3 py-2.5" data-testid={`top-affiliate-${i + 1}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-heading font-black text-xs shrink-0 ${
                  i === 0 ? 'bg-brand-main text-white'
                  : i < 3 ? 'bg-brand-light text-brand-main'
                  : 'bg-bg-secondary text-txt-secondary'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/backoffice/usuarios/${a.user_id}`} className="font-semibold text-sm hover:text-brand-main truncate block">
                    {a.name}
                  </Link>
                  <div className="text-[11px] text-txt-secondary truncate">
                    {a.referral_code && <span className="font-mono mr-2">#{a.referral_code}</span>}
                    {a.direct_orders} {a.direct_orders === 1 ? 'pedido' : 'pedidos'} · {a.referrals_count} {a.referrals_count === 1 ? 'indicado' : 'indicados'}
                  </div>
                </div>
                <Badge variant={net.variant} className="hidden sm:inline-flex">{net.label}</Badge>
                <div className="text-right shrink-0">
                  <div className="font-heading font-black text-sm text-emerald-600" title="Soma do subtotal dos pedidos pagos pela 1ª pessoa indicada">
                    {formatCurrency(a.direct_revenue)}
                  </div>
                  <div className="text-[11px] text-txt-secondary">comissão: {formatCurrency(a.commission_total)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function CommissionsCard({ summary }) {
  const items = [
    { label: 'Pendentes', key: 'pending', color: 'text-amber-600 bg-amber-50' },
    { label: 'Pagas', key: 'paid', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Sacadas', key: 'paid_out', color: 'text-sky-600 bg-sky-50' },
    { label: 'Canceladas', key: 'cancelled', color: 'text-rose-600 bg-rose-50' },
  ];
  return (
    <div className="bg-white rounded-2xl border border-border p-5" data-testid="commissions-summary-card">
      <div className="flex items-center gap-2 mb-3">
        <CircleDollarSign className="w-5 h-5 text-brand-main" />
        <h2 className="font-heading font-black text-lg">Comissões</h2>
      </div>
      <ul className="space-y-2">
        {items.map(it => (
          <li key={it.key} className={`flex items-center justify-between p-3 rounded-lg ${it.color}`}>
            <span className="text-xs font-bold uppercase tracking-wider">{it.label}</span>
            <span className="font-heading font-black text-base">{formatCurrency(summary[it.key] || 0)}</span>
          </li>
        ))}
      </ul>
      <Link to="/backoffice/relatorio-comissoes" className="text-xs text-brand-main font-semibold flex items-center gap-1 mt-4 hover:underline">
        Ver relatório completo <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function RecentOrdersCard({ items, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-border p-5 ${className}`} data-testid="recent-orders-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-black text-lg">Pedidos recentes</h2>
        <Link to="/backoffice/pedidos" className="text-xs text-brand-main font-semibold flex items-center gap-1 hover:underline">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-txt-secondary text-center py-8">Sem pedidos ainda.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-2 font-semibold">Pedido</th>
                <th className="text-left p-2 font-semibold">Cliente</th>
                <th className="text-left p-2 font-semibold">Data</th>
                <th className="text-center p-2 font-semibold">Status</th>
                <th className="text-right p-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => {
                const s = STATUS[o.order_status] || STATUS.pending;
                return (
                  <tr key={o.order_id} className="border-t border-border hover:bg-bg-secondary/40">
                    <td className="p-2 font-mono text-xs">#{o.order_id?.slice(-8).toUpperCase()}</td>
                    <td className="p-2 truncate max-w-[180px]">{o.customer_name || '-'}</td>
                    <td className="p-2 text-xs text-txt-secondary whitespace-nowrap">{o.created_at ? formatDateTime(o.created_at) : '-'}</td>
                    <td className="p-2 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="p-2 text-right font-bold">{formatCurrency(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* Recent orders card */
