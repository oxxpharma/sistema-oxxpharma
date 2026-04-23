import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Wallet, Search, Check, X, DollarSign, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'paid_out', label: 'Pagos' },
  { value: 'rejected', label: 'Rejeitados' },
  { value: 'cancelled', label: 'Cancelados' },
];
const STATUS_META = {
  pending: { label: 'Pendente', variant: 'warning' },
  approved: { label: 'Aprovado', variant: 'info' },
  paid_out: { label: 'Pago', variant: 'success' },
  rejected: { label: 'Rejeitado', variant: 'error' },
  cancelled: { label: 'Cancelado', variant: 'default' },
};

export default function AdminWithdrawals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (search) q.set('search', search);
      q.set('limit', '100');
      const d = await api.get(`/api/admin/withdrawals?${q}`);
      setData(d);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const act = async (endpoint, body = undefined) => {
    setBusy(true);
    try {
      const updated = body !== undefined
        ? await api.put(endpoint, body)
        : await api.put(endpoint);
      setSelected(updated);
      toast.success('Atualizado');
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get(`/api/admin/withdrawals/export?status=${status || 'approved'}`);
      if (!res.rows?.length) { toast.error('Nada para exportar'); return; }
      const headers = ['withdrawal_id', 'cpf', 'name', 'email', 'pix_key_type', 'pix_key', 'amount', 'created_at'];
      const csv = [
        headers.join(','),
        ...res.rows.map(r => headers.map(h => {
          const v = r[h];
          const s = v === null || v === undefined ? '' : String(v).replace(/"/g, '""');
          return s.includes(',') || s.includes('"') ? `"${s}"` : s;
        }).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saques_${status || 'approved'}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exportado');
    } catch (err) { toast.error(err.message); }
  };

  const summary = data?.summary || {};

  return (
    <div data-testid="admin-withdrawals">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
            <Wallet className="w-7 h-7 text-brand-main" /> Saques
          </h1>
          <p className="text-sm text-txt-secondary mt-1">Gerencie as solicitações de saque dos usuários.</p>
        </div>
        <Button onClick={exportCsv}><Download className="w-4 h-4" /> Exportar CSV</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Object.entries(STATUS_META).map(([key, m]) => {
          const s = summary[key] || { total: 0, count: 0 };
          return (
            <div key={key} className="bg-white rounded-xl border border-border p-4">
              <Badge variant={m.variant}>{m.label}</Badge>
              <div className="mt-2 text-xl font-heading font-black">{formatCurrency(s.total)}</div>
              <div className="text-xs text-txt-secondary">{s.count} solicitaç{s.count === 1 ? 'ão' : 'ões'}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-3 mb-4 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou CPF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-lg text-sm"
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" data-testid="wd-status-filter">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Button variant="outline" onClick={load}>Buscar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">CPF</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">PIX</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.withdrawals?.map(w => {
                  const m = STATUS_META[w.status] || STATUS_META.pending;
                  return (
                    <tr key={w.withdrawal_id} className="border-t border-border hover:bg-bg-secondary/50" data-testid={`admin-wd-${w.withdrawal_id}`}>
                      <td className="p-3 text-xs">{formatDateTime(w.created_at)}</td>
                      <td className="p-3">
                        <div className="font-semibold">{w.pix_name || w.user_name}</div>
                        <div className="text-xs text-txt-secondary">{w.user_email}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{w.pix_cpf || '-'}</td>
                      <td className="p-3 text-right font-bold">{formatCurrency(w.amount)}</td>
                      <td className="p-3 text-xs">
                        <div className="uppercase font-semibold">{w.pix_key_type}</div>
                        <div className="font-mono text-txt-secondary">{w.pix_key}</div>
                      </td>
                      <td className="p-3 text-center"><Badge variant={m.variant}>{m.label}</Badge></td>
                      <td className="p-3 text-right">
                        <button onClick={() => { setSelected(w); setRejectReason(''); }} className="text-brand-main hover:underline text-xs font-semibold">
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!data?.withdrawals?.length && <tr><td colSpan={7} className="p-10 text-center text-txt-secondary">Nenhum saque encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-heading font-black text-lg">Saque #{selected.withdrawal_id.slice(-8).toUpperCase()}</h2>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-txt-secondary">Usuário</div><div className="font-bold">{selected.user_name}</div><div className="text-xs">{selected.user_email}</div></div>
                <div><div className="text-xs text-txt-secondary">Valor</div><div className="font-heading font-black text-xl text-brand-main">{formatCurrency(selected.amount)}</div></div>
              </div>
              <div>
                <div className="text-xs text-txt-secondary">PIX</div>
                <div className="bg-bg-secondary rounded-lg p-3 mt-1 space-y-1">
                  <div><strong>CPF:</strong> {selected.pix_cpf}</div>
                  <div><strong>Nome:</strong> {selected.pix_name}</div>
                  <div><strong>Tipo:</strong> {selected.pix_key_type}</div>
                  <div><strong>Chave:</strong> <span className="font-mono">{selected.pix_key}</span></div>
                </div>
              </div>
              {selected.admin_notes && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                  <strong>Observação admin:</strong> {selected.admin_notes}
                </div>
              )}
              <div className="text-xs text-txt-secondary">Criado em {formatDateTime(selected.created_at)}</div>
              {selected.paid_at && <div className="text-xs text-emerald-600">Pago em {formatDateTime(selected.paid_at)}</div>}
            </div>
            <div className="p-6 border-t border-border space-y-3">
              {selected.status === 'pending' && (
                <>
                  <Button onClick={() => act(`/api/admin/withdrawals/${selected.withdrawal_id}/approve`)} loading={busy} className="w-full" data-testid="approve-wd-btn">
                    <Check className="w-4 h-4" /> Aprovar
                  </Button>
                  <div>
                    <input
                      type="text"
                      placeholder="Motivo da rejeição (opcional)"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="w-full h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm mb-2"
                    />
                    <Button variant="danger" onClick={() => act(`/api/admin/withdrawals/${selected.withdrawal_id}/reject`, { reason: rejectReason })} loading={busy} className="w-full" data-testid="reject-wd-btn">
                      <X className="w-4 h-4" /> Rejeitar
                    </Button>
                  </div>
                </>
              )}
              {selected.status === 'approved' && (
                <Button onClick={() => act(`/api/admin/withdrawals/${selected.withdrawal_id}/mark-paid`)} loading={busy} className="w-full" data-testid="mark-paid-btn">
                  <DollarSign className="w-4 h-4" /> Marcar como pago
                </Button>
              )}
              {(selected.status === 'pending' || selected.status === 'approved') && selected.status === 'pending' ? null : (
                selected.status === 'approved' && (
                  <Button variant="outline" onClick={() => act(`/api/admin/withdrawals/${selected.withdrawal_id}/reject`, { reason: rejectReason || 'Cancelado pelo admin' })} loading={busy} className="w-full">
                    Rejeitar
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
