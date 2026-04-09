import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard, StatCard } from '../components/layout/AppLayout';
import { DollarSign, Clock, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CommissionsPage() {
  const { token } = useAuth();
  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [page, filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/commissions?page=${page}&limit=20`;
      if (filter) url += `&status=${filter}`;
      const [cRes, sRes] = await Promise.all([
        fetch(url, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/commissions/summary`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (cRes.ok) { const d = await cRes.json(); setCommissions(d.commissions); setTotal(d.total); }
      if (sRes.ok) setSummary(await sRes.json());
    } catch {} finally { setLoading(false); }
  };

  const genLabel = (g) => g === 0 ? 'Nacional' : `${g}a Geracao`;

  const statusBadge = (s) => {
    const colors = {
      blocked: 'bg-amber-100 text-amber-700',
      available: 'bg-green-100 text-green-700',
      reversed: 'bg-red-100 text-red-600',
    };
    const labels = { blocked: 'Bloqueado', available: 'Disponivel', reversed: 'Estornado' };
    return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[s] || 'bg-gray-100'}`}>{labels[s] || s}</span>;
  };

  return (
    <AppLayout title="Comissoes" subtitle="Acompanhe suas comissoes">
      <div className="space-y-6 fade-in">
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={DollarSign} label="Este Mes" value={formatCurrency(summary.this_month)} color="orange" />
            <StatCard icon={TrendingUp} label="Disponivel" value={formatCurrency(summary.available_balance)} color="green" />
            <StatCard icon={Clock} label="Bloqueado" value={formatCurrency(summary.blocked_balance)} color="amber" />
          </div>
        )}

        {summary?.by_generation && Object.keys(summary.by_generation).length > 0 && (
          <DashCard title="Comissoes por Geracao">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(summary.by_generation).map(([gen, data]) => (
                <div key={gen} className="px-3 py-2 bg-bg-secondary rounded-md border border-border text-center">
                  <p className="text-[11px] text-txt-secondary font-medium">{genLabel(parseInt(gen))}</p>
                  <p className="text-sm font-heading font-bold text-brand-main mt-0.5">{formatCurrency(data.total)}</p>
                  <p className="text-[10px] text-txt-secondary">{data.count} vendas</p>
                </div>
              ))}
            </div>
          </DashCard>
        )}

        <DashCard title="Historico" action={
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-md px-2 py-1 bg-white" data-testid="commission-filter">
            <option value="">Todos</option>
            <option value="blocked">Bloqueados</option>
            <option value="available">Disponiveis</option>
            <option value="reversed">Estornados</option>
          </select>
        } noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Pedido</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Geracao</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Taxa</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Valor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Data</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-txt-secondary">Carregando...</td></tr>
                ) : commissions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-txt-secondary">Nenhuma comissao</td></tr>
                ) : commissions.map(c => (
                  <tr key={c.commission_id} className="border-b border-border hover:bg-bg-secondary/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-txt-secondary">{c.order_id}</td>
                    <td className="px-4 py-2.5">{genLabel(c.generation)}</td>
                    <td className="px-4 py-2.5 text-txt-secondary">{c.rate}%</td>
                    <td className="px-4 py-2.5 text-right font-bold text-brand-main">{formatCurrency(c.amount)}</td>
                    <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
                    <td className="px-4 py-2.5 text-xs text-txt-secondary">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-txt-secondary">Pagina {page}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-md hover:bg-bg-secondary disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => p + 1)} disabled={commissions.length < 20} className="p-1.5 rounded-md hover:bg-bg-secondary disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </DashCard>
      </div>
    </AppLayout>
  );
}
