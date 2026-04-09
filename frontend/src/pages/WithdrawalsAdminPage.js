import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { formatCurrency, formatDate } from '../lib/utils';
import { Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function WithdrawalsPage() {
  const { token } = useAuth();
  const [withdrawals, setWithdrawals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchWithdrawals(); }, [page, filter]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/withdrawals?page=${page}&limit=15`;
      if (filter) url += `&status=${filter}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setWithdrawals(d.withdrawals); setTotal(d.total); }
    } catch {} finally { setLoading(false); }
  };

  const updateStatus = async (wdId, status) => {
    await fetch(`${API_URL}/api/withdrawals/${wdId}?status=${status}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    fetchWithdrawals();
  };

  const statusBadge = (s) => {
    const colors = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-orange-100 text-orange-700', paid: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-600' };
    return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[s] || 'bg-gray-100'}`}>{s}</span>;
  };

  return (
    <AppLayout title="Saques" subtitle={`${total} solicitacoes`}>
      <div className="space-y-4 fade-in">
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-border rounded-md text-sm bg-white" data-testid="withdrawals-filter">
          <option value="">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovados</option>
          <option value="paid">Pagos</option>
          <option value="rejected">Rejeitados</option>
        </select>

        <div className="bg-white border border-border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">ID</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Valor</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Taxa</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Liquido</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Data</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-txt-secondary">Carregando...</td></tr>
                ) : withdrawals.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-txt-secondary">Nenhum saque</td></tr>
                ) : withdrawals.map(w => (
                  <tr key={w.withdrawal_id} className="border-b border-border hover:bg-bg-secondary/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{w.withdrawal_id}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(w.amount)}</td>
                    <td className="px-4 py-2.5 text-right text-txt-secondary">{formatCurrency(w.fee)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-accent-green">{formatCurrency(w.net_amount)}</td>
                    <td className="px-4 py-2.5">{statusBadge(w.status)}</td>
                    <td className="px-4 py-2.5 text-xs text-txt-secondary">{formatDate(w.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {w.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => updateStatus(w.withdrawal_id, 'approved')}
                            className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded hover:bg-green-200"
                            data-testid={`approve-wd-${w.withdrawal_id}`}>Aprovar</button>
                          <button onClick={() => updateStatus(w.withdrawal_id, 'rejected')}
                            className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-600 rounded hover:bg-red-200"
                            data-testid={`reject-wd-${w.withdrawal_id}`}>Rejeitar</button>
                        </div>
                      )}
                      {w.status === 'approved' && (
                        <button onClick={() => updateStatus(w.withdrawal_id, 'paid')}
                          className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                          data-testid={`pay-wd-${w.withdrawal_id}`}>Marcar Pago</button>
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
