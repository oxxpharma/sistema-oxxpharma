import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Loader2, AlertTriangle, X, Undo2, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

/**
 * Modal generico para mudanca de status de comissoes.
 *
 * mode:
 *   - 'revert'  : paid|paid_out -> pending (chama /api/admin/commissions/revert/*)
 *   - 'approve' : pending -> paid (chama /api/admin/commissions/approve/*)
 *
 * Props:
 *  - open, onClose
 *  - mode: 'revert' | 'approve'
 *  - filters: { commission_ids | order_ids | user_id | start | end | status_in? }
 *  - title, description, onSuccess
 */
export default function CommissionsStatusModal({ open, onClose, mode = 'revert', filters, title, description, onSuccess }) {
  const cfg = mode === 'approve' ? {
    endpoint: '/api/admin/commissions/approve',
    actionLabel: 'Aprovar',
    actionVerb: 'aprovada(s)',
    confirmWord: 'APROVAR',
    icon: CheckCircle2,
    iconBg: 'bg-emerald-100 text-emerald-600',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700',
    titleDefault: 'Aprovar cashbacks (→ Pago)',
    descDefault: 'Marca como "Pago" — usuário poderá solicitar saque.',
  } : {
    endpoint: '/api/admin/commissions/revert',
    actionLabel: 'Reverter',
    actionVerb: 'revertida(s)',
    confirmWord: 'REVERTER',
    icon: Undo2,
    iconBg: 'bg-amber-100 text-amber-600',
    btnClass: 'bg-amber-600 hover:bg-amber-700',
    titleDefault: 'Reverter cashbacks (→ Pendente)',
    descDefault: 'Volta status para "pendente" e desvincula do saque (se houver).',
  };

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!open || !filters) return;
    let cancelled = false;
    setPreview(null);
    setConfirmText('');
    setLoading(true);
    api.post(`${cfg.endpoint}/preview`, filters)
      .then(r => { if (!cancelled) setPreview(r); })
      .catch(e => { if (!cancelled) toast.error(e?.message || 'Erro no preview'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, filters, cfg.endpoint]);

  if (!open) return null;

  const total = preview?.total || 0;
  const requiresConfirmText = total > 1;
  const canApply = preview && total > 0 && (!requiresConfirmText || confirmText === cfg.confirmWord);

  const apply = async () => {
    setApplying(true);
    try {
      const body = { ...filters };
      if (total > 1) body.confirm = true;
      const r = await api.post(`${cfg.endpoint}/apply`, body);
      toast.success(`${r.modified} cashback(ões) ${cfg.actionVerb} — total ${formatCurrency(r.total_amount)}`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e?.message || `Falha ao ${cfg.actionLabel.toLowerCase()}`);
    } finally {
      setApplying(false);
    }
  };

  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-3 md:p-6 overflow-y-auto" data-testid={`commissions-status-modal-${mode}`}>
      <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg ${cfg.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg">{title || cfg.titleDefault}</h2>
              <p className="text-xs text-txt-secondary mt-1">{description || cfg.descDefault}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-secondary" data-testid="status-modal-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="text-center py-10"><Loader2 className="w-7 h-7 animate-spin inline text-brand-main" /></div>
          ) : !preview ? (
            <div className="text-sm text-txt-secondary text-center py-6">Sem dados.</div>
          ) : total === 0 ? (
            <div className="text-sm text-txt-secondary text-center py-6">
              {mode === 'approve'
                ? 'Nenhuma cashback pendente nos critérios selecionados.'
                : 'Nenhuma cashback atende aos critérios (apenas paid e paid_out podem ser revertidas).'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Cashbacks" value={total} testId="status-total" />
                <Stat label="Valor total" value={formatCurrency(preview.total_amount)} testId="status-amount" />
                <Stat label="Beneficiários" value={preview.affected_users} />
                <Stat label="Saques afetados" value={preview.affected_withdrawals?.length || 0} />
              </div>

              {mode === 'revert' && (preview.affected_withdrawals?.length || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Atenção — cashbacks já saqueadas</div>
                    <div className="mt-1">{preview.affected_withdrawals.length} saque(s) tinham essas cashbacks: <span className="font-mono">{preview.affected_withdrawals.slice(0, 4).join(', ')}{preview.affected_withdrawals.length > 4 ? `… (+${preview.affected_withdrawals.length - 4})` : ''}</span>. Os documentos de <em>withdrawal</em> não serão alterados, mas a vinculação <code>withdrawal_id</code> nas cashbacks será removida.</div>
                  </div>
                </div>
              )}

              <div className="border border-border rounded-lg max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-bg-secondary text-[10px] uppercase text-txt-secondary sticky top-0">
                    <tr>
                      <th className="text-left p-2">Pedido</th>
                      <th className="text-left p-2">Beneficiário</th>
                      <th className="text-right p-2">Valor</th>
                      <th className="text-center p-2">Status atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.slice(0, 200).map(it => (
                      <tr key={it.commission_id} className="border-t border-border">
                        <td className="p-2 font-mono text-[10px]">{it.order_id?.slice(0, 14)}</td>
                        <td className="p-2">{it.customer_name || it.user_id}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(it.amount)}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            it.status === 'paid_out' ? 'bg-purple-100 text-purple-700'
                            : it.status === 'paid' ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                            {it.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.shown < total && <div className="text-[10px] text-txt-secondary p-2 text-center">Mostrando {preview.shown} de {total} (todos serão {cfg.actionVerb} ao aplicar).</div>}
              </div>

              {requiresConfirmText && (
                <div>
                  <label className="text-xs font-semibold text-txt-secondary block mb-1">
                    Para confirmar a operação em massa, digite <code className="bg-bg-secondary px-1 py-0.5 rounded font-mono">{cfg.confirmWord}</code>:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    className="h-10 w-full px-3 bg-bg-secondary border border-border rounded-lg text-sm font-mono"
                    placeholder={cfg.confirmWord}
                    data-testid="status-confirm-input"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-5 border-t border-border flex flex-col-reverse md:flex-row md:justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={applying} data-testid="status-cancel-btn">Cancelar</Button>
          <Button variant="default" onClick={apply} disabled={!canApply || applying} data-testid="status-apply-btn" className={cfg.btnClass}>
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            {applying ? `${cfg.actionLabel}…` : `${cfg.actionLabel} ${total > 0 ? total : ''} cashback${total > 1 ? 'ões' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, testId }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-center" data-testid={testId}>
      <div className="text-xl font-heading font-black">{value}</div>
      <div className="text-[10px] uppercase text-txt-secondary">{label}</div>
    </div>
  );
}
