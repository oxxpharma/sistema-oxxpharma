import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Wallet, Clock, CheckCircle2, TrendingUp, Plus, X, AlertCircle, Loader2, BanIcon } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_META = {
  pending: { label: 'Aguardando análise', variant: 'warning' },
  approved: { label: 'Aprovado', variant: 'info' },
  paid_out: { label: 'Pago', variant: 'success' },
  rejected: { label: 'Rejeitado', variant: 'error' },
  cancelled: { label: 'Cancelado', variant: 'default' },
};

export default function MyWithdrawals() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, w] = await Promise.all([
        api.get('/api/users/me/balance'),
        api.get('/api/users/me/withdrawals'),
      ]);
      setBalance(b);
      setWithdrawals(w.withdrawals || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const cancel = async (wid) => {
    if (!window.confirm('Cancelar esta solicitação?')) return;
    try { await api.post(`/api/users/me/withdrawals/${wid}/cancel`); toast.success('Cancelada'); load(); } catch (err) { toast.error(err.message); }
  };

  if (loading || !balance) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" data-testid="my-withdrawals">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
          <Wallet className="w-7 h-7 text-brand-main" /> Meus saques
        </h1>
        {balance.withdrawal_enabled && balance.available >= balance.withdrawal_min_amount && (
          <Button onClick={() => setShowForm(true)} data-testid="request-withdrawal-btn"><Plus className="w-4 h-4" /> Solicitar saque</Button>
        )}
      </div>

      {!balance.withdrawal_enabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3" data-testid="withdraw-disabled">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Saques temporariamente indisponíveis.</strong> Seus valores continuam acumulando — assim que o administrador reabrir os saques, você poderá sacar.
          </div>
        </div>
      )}

      {/* Cards de saldo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-5" data-testid="card-available">
          <Wallet className="w-6 h-6 mb-2 opacity-80" />
          <div className="text-2xl font-heading font-black">{formatCurrency(balance.available)}</div>
          <div className="text-xs opacity-80 mt-0.5">Disponível para saque</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <Clock className="w-6 h-6 text-amber-500 mb-2" />
          <div className="text-2xl font-heading font-black">{formatCurrency(balance.quarantine)}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Em quarentena ({balance.withdrawal_release_days}d)</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <TrendingUp className="w-6 h-6 text-brand-main mb-2" />
          <div className="text-2xl font-heading font-black">{formatCurrency(balance.pending_commissions)}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Comissões pendentes</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <CheckCircle2 className="w-6 h-6 text-blue-500 mb-2" />
          <div className="text-2xl font-heading font-black">{formatCurrency(balance.total_withdrawn)}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Total sacado</div>
        </div>
      </div>

      <div className="bg-bg-secondary rounded-xl p-4 text-xs text-txt-secondary mb-6 space-y-1">
        <div>• Valor mínimo de saque: <strong>{formatCurrency(balance.withdrawal_min_amount)}</strong></div>
        <div>• Tempo de quarentena: comissões pagas ficam bloqueadas por <strong>{balance.withdrawal_release_days} dias</strong> antes de liberar para saque.</div>
        <div>• Pagamento via PIX após aprovação do administrador.</div>
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-heading font-black text-lg">Histórico de solicitações</h2>
        </div>
        {withdrawals.length === 0 ? (
          <div className="p-12 text-center text-txt-secondary text-sm">Nenhuma solicitação ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">PIX</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-left p-3">Pago em</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map(w => {
                  const meta = STATUS_META[w.status] || STATUS_META.pending;
                  return (
                    <tr key={w.withdrawal_id} className="border-t border-border" data-testid={`wd-${w.withdrawal_id}`}>
                      <td className="p-3 text-xs">{formatDateTime(w.created_at)}</td>
                      <td className="p-3 text-right font-bold">{formatCurrency(w.amount)}</td>
                      <td className="p-3 text-xs text-txt-secondary">
                        <div className="font-mono">{w.pix_key}</div>
                        <div className="uppercase">{w.pix_key_type}</div>
                      </td>
                      <td className="p-3 text-center"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                      <td className="p-3 text-xs">{w.paid_at ? formatDateTime(w.paid_at) : '-'}</td>
                      <td className="p-3 text-right">
                        {w.status === 'pending' && (
                          <button onClick={() => cancel(w.withdrawal_id)} className="text-red-500 hover:underline text-xs" data-testid={`cancel-wd-${w.withdrawal_id}`}>
                            Cancelar
                          </button>
                        )}
                        {w.status === 'rejected' && w.admin_notes && (
                          <span className="text-xs text-red-500" title={w.admin_notes}>Motivo ✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <RequestModal balance={balance} user={user} onClose={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RequestModal({ balance, user, onClose }) {
  const [amount, setAmount] = useState(balance.available.toFixed(2));
  const [form, setForm] = useState({
    pix_key: user?.pix_key || user?.email || '',
    pix_key_type: user?.pix_key_type || 'email',
    pix_name: user?.name || '',
    pix_cpf: user?.cpf || '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Valor inválido'); return; }
    if (amt < balance.withdrawal_min_amount) { toast.error(`Mínimo: ${balance.withdrawal_min_amount}`); return; }
    if (amt > balance.available) { toast.error(`Disponível: ${balance.available}`); return; }
    if (!form.pix_cpf || !form.pix_name || !form.pix_key) { toast.error('Preencha CPF, nome e chave PIX'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/withdrawals', { ...form, amount: amt });
      toast.success('Solicitação enviada!');
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-black text-xl">Solicitar saque</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4" data-testid="withdrawal-form">
          <Input
            label={`Valor (disponível: ${formatCurrency(balance.available)})`}
            type="number"
            step="0.01"
            min={balance.withdrawal_min_amount}
            max={balance.available}
            required
            value={amount}
            onChange={e => setAmount(e.target.value)}
            hint={`Mínimo: ${formatCurrency(balance.withdrawal_min_amount)}`}
            data-testid="wd-amount"
          />
          <div className="pt-3 border-t border-border">
            <div className="text-sm font-bold mb-3">Dados PIX para recebimento</div>
            <div className="space-y-3">
              <Input label="CPF*" required value={form.pix_cpf} onChange={e => setForm({ ...form, pix_cpf: e.target.value })} placeholder="Somente números" data-testid="wd-cpf" />
              <Input label="Nome completo do titular*" required value={form.pix_name} onChange={e => setForm({ ...form, pix_name: e.target.value })} data-testid="wd-name" />
              <div className="grid grid-cols-3 gap-3">
                <Select label="Tipo da chave*" value={form.pix_key_type} onChange={e => setForm({ ...form, pix_key_type: e.target.value })}>
                  <option value="cpf">CPF</option>
                  <option value="email">Email</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Aleatória</option>
                </Select>
                <Input label="Chave PIX*" className="col-span-2" required value={form.pix_key} onChange={e => setForm({ ...form, pix_key: e.target.value })} data-testid="wd-pix" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-border">
            <Button type="submit" loading={submitting} data-testid="submit-wd-btn">Confirmar solicitação</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
