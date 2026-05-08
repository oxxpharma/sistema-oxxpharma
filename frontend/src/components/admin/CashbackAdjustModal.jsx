import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Loader2, X, Plus, Minus } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

/**
 * Modal de ajuste manual de cashback (super_admin only).
 * Cria uma comissao tipo admin_adjustment no backend.
 *
 * Props: { open, onClose, userId, userName, currentBalance, onSuccess }
 */
export default function CashbackAdjustModal({ open, onClose, userId, userName, currentBalance = 0, onSuccess }) {
  const [op, setOp] = useState('credit'); // credit | debit
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const num = parseFloat(amount.replace(',', '.')) || 0;
  const delta = op === 'credit' ? num : -num;
  const newBalance = currentBalance + delta;
  const noteValid = note.trim().length >= 3;
  const valueValid = num > 0;
  const balanceValid = op === 'credit' || newBalance >= 0;
  const canSubmit = noteValid && valueValid && balanceValid && !loading;

  const submit = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/api/admin/users/${userId}/cashback-adjust`, {
        delta, note: note.trim(),
      });
      toast.success(`Saldo atualizado: ${formatCurrency(r.previous_balance)} → ${formatCurrency(r.new_balance)}`);
      onSuccess?.();
      onClose();
      // reset
      setAmount(''); setNote(''); setOp('credit');
    } catch (e) {
      toast.error(e?.message || 'Falha ao ajustar saldo');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-3 md:p-6 overflow-y-auto" data-testid="cashback-adjust-modal">
      <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-lg flex flex-col">
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-black text-lg">Ajustar Cashback</h2>
            <p className="text-xs text-txt-secondary mt-1">{userName} — saldo disponível: <strong>{formatCurrency(currentBalance)}</strong></p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-secondary" data-testid="cashback-adjust-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs font-semibold text-txt-secondary uppercase block mb-2">Operação</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOp('credit')}
                className={`h-12 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition-colors ${op === 'credit' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border bg-white text-txt-secondary'}`}
                data-testid="cashback-op-credit"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
              <button
                onClick={() => setOp('debit')}
                className={`h-12 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition-colors ${op === 'debit' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-border bg-white text-txt-secondary'}`}
                data-testid="cashback-op-debit"
              >
                <Minus className="w-4 h-4" /> Remover
              </button>
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="text-xs font-semibold text-txt-secondary uppercase block mb-2">Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              className="h-11 w-full px-3 bg-bg-secondary border border-border rounded-lg text-sm font-mono"
              placeholder="0,00"
              data-testid="cashback-amount-input"
              autoFocus
            />
            {amount && !valueValid && <p className="text-xs text-rose-600 mt-1">Valor deve ser maior que zero.</p>}
            {op === 'debit' && valueValid && !balanceValid && (
              <p className="text-xs text-rose-600 mt-1">Saldo ficaria negativo (atual {formatCurrency(currentBalance)}).</p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-txt-secondary uppercase block mb-2">
              Descrição / Motivo <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm resize-none"
              placeholder="Ex: Bônus de campanha · Estorno do pedido X · Compensação por erro de integração…"
              data-testid="cashback-note-input"
              maxLength={500}
            />
            <p className="text-[11px] text-txt-secondary mt-1">{note.length}/500 — fica registrado para auditoria.</p>
          </div>

          {/* Resumo */}
          {valueValid && balanceValid && (
            <div className={`rounded-lg p-3 text-sm ${op === 'credit' ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
              <div className="flex justify-between">
                <span>Saldo atual</span>
                <span className="font-mono">{formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span>{op === 'credit' ? 'Crédito' : 'Débito'}</span>
                <span className={`font-mono font-bold ${op === 'credit' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {op === 'credit' ? '+' : '-'}{formatCurrency(num)}
                </span>
              </div>
              <div className="flex justify-between border-t border-current/20 mt-2 pt-2 font-bold">
                <span>Novo saldo</span>
                <span className="font-mono">{formatCurrency(newBalance)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex flex-col-reverse md:flex-row md:justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} data-testid="cashback-adjust-cancel">Cancelar</Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            data-testid="cashback-adjust-submit"
            className={op === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Aplicando…' : `Confirmar ${op === 'credit' ? 'crédito' : 'débito'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
