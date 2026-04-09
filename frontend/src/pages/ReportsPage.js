import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { StatCard, DashCard } from '../components/layout/AppLayout';
import { formatCurrency, formatDate } from '../lib/utils';
import {
  BarChart3, DollarSign, ShoppingBag, Users, TrendingUp, Package
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const COLORS = ['#E8731A', '#10B981', '#F5A623', '#8B5CF6', '#DC2626', '#6366F1', '#EC4899'];

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
        active ? 'bg-brand-main text-white' : 'text-txt-secondary hover:bg-bg-secondary'
      }`}>
      {children}
    </button>
  );
}

function PeriodSelector({ period, setPeriod }) {
  return (
    <div className="flex gap-1 bg-bg-secondary p-1 rounded-md" data-testid="period-selector">
      {[
        { key: 'week', label: 'Semana' },
        { key: 'month', label: 'Mes' },
        { key: 'quarter', label: 'Trimestre' },
        { key: 'year', label: 'Ano' },
      ].map(p => (
        <button key={p.key} onClick={() => setPeriod(p.key)}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
            period === p.key ? 'bg-white text-brand-main border border-border' : 'text-txt-secondary'
          }`} data-testid={`period-${p.key}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function SalesReport({ token }) {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/sales?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-main border-t-transparent rounded-full spinner" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PeriodSelector period={period} setPeriod={setPeriod} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingBag} label="Total Pedidos" value={data?.total_orders || 0} color="orange" />
        <StatCard icon={DollarSign} label="Pedidos Pagos" value={data?.paid_orders || 0} color="green" />
        <StatCard icon={TrendingUp} label="Receita Total" value={formatCurrency(data?.total_revenue || 0)} color="amber" />
        <StatCard icon={Package} label="Ticket Medio" value={formatCurrency(data?.avg_ticket || 0)} color="purple" />
      </div>

      {/* Daily Sales Chart */}
      {data?.daily_sales && data.daily_sales.length > 0 && (
        <DashCard title="Vendas Diarias">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily_sales.map(d => ({ date: d._id?.substr(5) || d._id, receita: d.total, pedidos: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: 12 }}
                  formatter={(val) => formatCurrency(val)} />
                <Bar dataKey="receita" fill="#E8731A" radius={[4, 4, 0, 0]} name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <DashCard title="Top Produtos" noPadding>
          {(!data?.top_products || data.top_products.length === 0) ? (
            <div className="p-8 text-center text-txt-secondary text-sm">Sem dados de produtos</div>
          ) : (
            <div className="divide-y divide-border">
              {data.top_products.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-bg-secondary text-txt-secondary'
                  }`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-txt-primary truncate">{p._id}</p>
                    <p className="text-xs text-txt-secondary">{p.qty} unidades</p>
                  </div>
                  <span className="text-sm font-bold text-brand-main">{formatCurrency(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* Sales by Status */}
        <DashCard title="Pedidos por Status">
          {(!data?.by_status || data.by_status.length === 0) ? (
            <div className="p-8 text-center text-txt-secondary text-sm">Sem dados</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.by_status.map(s => ({ name: s._id, value: s.count }))}
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                    dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {data.by_status.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
}

function CommissionsReport({ token }) {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/commissions?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-main border-t-transparent rounded-full spinner" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PeriodSelector period={period} setPeriod={setPeriod} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard icon={DollarSign} label="Total Comissoes" value={formatCurrency(data?.total_commissions || 0)} color="orange" />
        <StatCard icon={TrendingUp} label="Total Ocorrencias" value={data?.total_count || 0} color="green" />
      </div>

      {/* By Generation */}
      {data?.by_generation && data.by_generation.length > 0 && (
        <DashCard title="Comissoes por Geracao">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_generation.map(g => ({ name: g.label, total: g.total, count: g.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fill: '#4B5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: 12 }}
                  formatter={(val) => formatCurrency(val)} />
                <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Level */}
        <DashCard title="Comissoes por Nivel" noPadding>
          {(!data?.by_level || data.by_level.length === 0) ? (
            <div className="p-8 text-center text-txt-secondary text-sm">Sem dados</div>
          ) : (
            <div className="divide-y divide-border">
              {data.by_level.map((l, idx) => (
                <div key={idx} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-md bg-bg-secondary flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-txt-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-txt-primary">{l.label}</p>
                    <p className="text-xs text-txt-secondary">{l.count} pagamentos</p>
                  </div>
                  <span className="text-sm font-bold text-accent-green">{formatCurrency(l.total)}</span>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* Top Earners */}
        <DashCard title="Top Comissionados" noPadding>
          {(!data?.top_earners || data.top_earners.length === 0) ? (
            <div className="p-8 text-center text-txt-secondary text-sm">Sem dados</div>
          ) : (
            <div className="divide-y divide-border">
              {data.top_earners.map((e, idx) => (
                <div key={idx} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-bg-secondary text-txt-secondary'
                  }`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-txt-primary truncate">{e.name}</p>
                    <p className="text-xs text-txt-secondary">{e.level} {e.state ? `- ${e.state}` : ''}</p>
                  </div>
                  <span className="text-sm font-bold text-brand-main">{formatCurrency(e.total)}</span>
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>

      {/* By Status */}
      {data?.by_status && data.by_status.length > 0 && (
        <DashCard title="Por Status">
          <div className="flex flex-wrap gap-4">
            {data.by_status.map((s, idx) => {
              const statusLabels = { blocked: 'Bloqueados', available: 'Disponiveis', reversed: 'Estornados' };
              const statusColors = { blocked: 'text-amber-600', available: 'text-accent-green', reversed: 'text-accent-red' };
              return (
                <div key={idx} className="px-4 py-3 bg-bg-secondary rounded-md border border-border">
                  <p className="text-xs text-txt-secondary">{statusLabels[s._id] || s._id}</p>
                  <p className={`text-lg font-heading font-bold ${statusColors[s._id] || 'text-txt-primary'}`}>{formatCurrency(s.total)}</p>
                  <p className="text-[10px] text-txt-secondary">{s.count} registros</p>
                </div>
              );
            })}
          </div>
        </DashCard>
      )}
    </div>
  );
}

function NetworkReport({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/network`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-main border-t-transparent rounded-full spinner" /></div>;

  return (
    <div className="space-y-6">
      <StatCard icon={Users} label="Novos Este Mes" value={data?.new_this_month || 0} color="green" />

      {/* By Level */}
      {data?.by_level && data.by_level.length > 0 && (
        <DashCard title="Usuarios por Nivel">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_level}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: 12 }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Usuarios" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By State */}
        <DashCard title="Usuarios por Estado" noPadding>
          {(!data?.by_state || data.by_state.length === 0) ? (
            <div className="p-8 text-center text-txt-secondary text-sm">Sem dados por estado</div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {data.by_state.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-sm font-medium text-txt-primary">{s._id}</span>
                  <span className="px-2 py-0.5 rounded bg-brand-light text-xs font-bold text-brand-main">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* Daily Signups */}
        {data?.daily_signups && data.daily_signups.length > 0 && (
          <DashCard title="Cadastros Diarios (Mes)">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily_signups.map(d => ({ date: d._id?.substr(5) || d._id, cadastros: d.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: 12 }} />
                  <Line type="monotone" dataKey="cadastros" stroke="#E8731A" strokeWidth={2} dot={{ r: 3 }} name="Cadastros" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashCard>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState('sales');

  return (
    <AppLayout title="Relatorios" subtitle="Analise detalhada do sistema">
      <div className="space-y-6 fade-in">
        <div className="flex gap-2 border-b border-border pb-3" data-testid="report-tabs">
          <TabButton active={tab === 'sales'} onClick={() => setTab('sales')}>Vendas</TabButton>
          <TabButton active={tab === 'commissions'} onClick={() => setTab('commissions')}>Comissoes</TabButton>
          <TabButton active={tab === 'network'} onClick={() => setTab('network')}>Rede</TabButton>
        </div>
        {tab === 'sales' && <SalesReport token={token} />}
        {tab === 'commissions' && <CommissionsReport token={token} />}
        {tab === 'network' && <NetworkReport token={token} />}
      </div>
    </AppLayout>
  );
}
