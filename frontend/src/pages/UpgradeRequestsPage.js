import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowUpCircle, Check, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function UpgradeRequestsPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRequests(); }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/upgrade/requests?limit=50`;
      if (filter) url += `&status=${filter}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setRequests(d.requests); setTotal(d.total); }
    } catch {} finally { setLoading(false); }
  };

  const handleAction = async (requestId, action) => {
    const confirmMsg = action === 'approve' ? 'Aprovar upgrade deste indicador?' : 'Rejeitar esta solicitacao?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await fetch(`${API_URL}/api/upgrade/requests/${requestId}?action=${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchRequests();
    } catch {}
  };

  const statusBadge = (s) => {
    const colors = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-600' };
    const labels = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' };
    return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[s] || 'bg-gray-100'}`}>{labels[s] || s}</span>;
  };

  return (
    <AppLayout title="Solicitacoes de Upgrade" subtitle={`${total} solicitacoes`}>
      <div className="space-y-4 fade-in">
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-2.5 border border-border rounded-md text-sm bg-white" data-testid="upgrade-requests-filter">
          <option value="">Todas</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovadas</option>
          <option value="rejected">Rejeitadas</option>
        </select>

        <div className="bg-white border border-border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Usuario</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Email</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Indicacoes</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Investimento</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Data</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-txt-secondary">Carregando...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-txt-secondary">Nenhuma solicitacao</td></tr>
                ) : requests.map(r => (
                  <tr key={r.request_id} className="border-b border-border hover:bg-bg-secondary/50" data-testid={`upgrade-req-${r.request_id}`}>
                    <td className="px-4 py-2.5 font-medium text-txt-primary">{r.user_name}</td>
                    <td className="px-4 py-2.5 text-txt-secondary">{r.user_email}</td>
                    <td className="px-4 py-2.5 text-center">{r.total_referrals}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-brand-main">{formatCurrency(r.investment_amount)}</td>
                    <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                    <td className="px-4 py-2.5 text-xs text-txt-secondary">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleAction(r.request_id, 'approve')}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-green-100 text-green-700 rounded hover:bg-green-200 transition-all"
                            data-testid={`approve-upgrade-${r.request_id}`}>
                            <Check className="w-3.5 h-3.5" /> Aprovar
                          </button>
                          <button onClick={() => handleAction(r.request_id, 'reject')}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-100 text-red-600 rounded hover:bg-red-200 transition-all"
                            data-testid={`reject-upgrade-${r.request_id}`}>
                            <X className="w-3.5 h-3.5" /> Rejeitar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
