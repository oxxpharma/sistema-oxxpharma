import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Paginação genérica para listagens administrativas.
 * Props:
 *  - page: número da página atual (1-based)
 *  - pages: total de páginas
 *  - total: total de itens (opcional, para exibir "X de Y")
 *  - limit: itens por página (opcional, para exibir intervalo)
 *  - onChange(newPage): callback ao trocar de página
 *  - testId: prefixo para data-testid
 */
export default function Pagination({ page = 1, pages = 1, total, limit, onChange, testId = 'pagination' }) {
  const safePage = Math.max(1, Math.min(page, pages));
  const canPrev = safePage > 1;
  const canNext = safePage < pages;

  // Gera lista compacta: 1 ... 4 5 [6] 7 8 ... 20
  const getPageList = () => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const list = new Set([1, pages, safePage, safePage - 1, safePage + 1]);
    if (safePage <= 3) [2, 3, 4].forEach(n => list.add(n));
    if (safePage >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach(n => list.add(n));
    const arr = Array.from(list).filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
    const out = [];
    arr.forEach((n, i) => {
      if (i > 0 && n - arr[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  };

  const rangeText = (() => {
    if (typeof total !== 'number' || !limit) return null;
    if (total === 0) return '0 itens';
    const from = (safePage - 1) * limit + 1;
    const to = Math.min(safePage * limit, total);
    return `${from}–${to} de ${total}`;
  })();

  if (pages <= 1 && (!total || total <= (limit || 0))) {
    return rangeText ? (
      <div className="text-xs text-txt-secondary mt-3" data-testid={`${testId}-info`}>{rangeText}</div>
    ) : null;
  }

  const list = getPageList();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4" data-testid={testId}>
      {rangeText && <div className="text-xs text-txt-secondary" data-testid={`${testId}-info`}>{rangeText}</div>}
      <div className="flex items-center gap-1 ml-auto">
        <button
          type="button"
          onClick={() => canPrev && onChange(safePage - 1)}
          disabled={!canPrev}
          className="px-2 py-1.5 rounded-md border border-border bg-white text-txt-primary text-xs font-semibold hover:bg-bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          data-testid={`${testId}-prev`}
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
        </button>
        {list.map((n, i) => (
          n === '…' ? (
            <span key={`e-${i}`} className="px-1.5 text-txt-secondary text-xs select-none">…</span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`min-w-[32px] px-2 py-1.5 rounded-md text-xs font-semibold transition border ${
                n === safePage
                  ? 'bg-brand-main text-white border-brand-main'
                  : 'bg-white text-txt-primary border-border hover:bg-bg-secondary'
              }`}
              data-testid={`${testId}-page-${n}`}
              aria-current={n === safePage ? 'page' : undefined}
            >
              {n}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={() => canNext && onChange(safePage + 1)}
          disabled={!canNext}
          className="px-2 py-1.5 rounded-md border border-border bg-white text-txt-primary text-xs font-semibold hover:bg-bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          data-testid={`${testId}-next`}
          aria-label="Próxima página"
        >
          Próxima <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
