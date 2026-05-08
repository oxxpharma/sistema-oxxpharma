import React from 'react';
import { Truck, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

/**
 * Barra de progresso visual ate o frete gratis.
 *
 * Props:
 *  - subtotal: number
 *  - threshold: number (ex: 199)
 *  - remaining: number (ex: 49)
 *  - applies: bool (frete gratis ja conquistado)
 *  - label: string (texto exibido quando aplicado, ex: "Frete grátis")
 *  - compact: bool (versao mais discreta para sidebar/checkout)
 *  - mini: bool (versao linha unica para product details, sem barra)
 */
export default function FreeShippingProgress({ subtotal = 0, threshold = 0, remaining = 0, applies = false, label = 'Frete grátis', compact = false, mini = false }) {
  // Versao MINI (linha unica, sem barra) - para product details
  if (mini) {
    if (applies) {
      return (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg" data-testid="fs-progress-mini-achieved">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Você ganha {label.toLowerCase()} neste pedido
        </div>
      );
    }
    if (!threshold || threshold <= 0) return null;
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg" data-testid="fs-progress-mini-remaining">
        <Truck className="w-3.5 h-3.5" />
        Faltam {formatCurrency(remaining)} para {label.toLowerCase()}
      </div>
    );
  }

  // Caso ja tenha conquistado
  if (applies) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
        data-testid="fs-progress-achieved"
      >
        <CheckCircle2 className={`text-emerald-600 ${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
        <div className={`flex-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="font-bold text-emerald-700">{label} liberado!</span>
          <span className="text-emerald-600/80 ml-1">Você não paga frete neste pedido 🎉</span>
        </div>
      </div>
    );
  }

  // Sem regra de threshold: nao mostra nada (ex: regras puramente por publico)
  if (!threshold || threshold <= 0) return null;

  const pct = Math.min(100, Math.max(0, (subtotal / threshold) * 100));

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
      data-testid="fs-progress-bar"
    >
      <div className={`flex items-center gap-2 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Truck className={`text-amber-600 ${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
        <div className="flex-1">
          Faltam <strong className="text-amber-800">{formatCurrency(remaining)}</strong> para você ganhar <strong className="text-amber-800">{label.toLowerCase()}</strong>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-2 rounded-full bg-amber-100 overflow-hidden" data-testid="fs-progress-track">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
          data-testid="fs-progress-fill"
        />
      </div>

      {/* Labels embaixo */}
      <div className={`flex justify-between mt-1.5 ${compact ? 'text-[10px]' : 'text-[11px]'} text-amber-700/70`}>
        <span>{formatCurrency(subtotal)}</span>
        <span>{formatCurrency(threshold)}</span>
      </div>
    </div>
  );
}
