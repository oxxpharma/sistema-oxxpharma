import React, { useMemo, useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Filtro de periodo com 2 modos:
 * - Mes/Ano (dropdown com preset "mes atual" default)
 * - Intervalo customizado (from / to)
 *
 * Props:
 *   value: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 *   onChange: (next) => void  // e' chamado ao clicar Aplicar/preset
 *   compact?: boolean         // versao menor para paginas de loja
 */
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function firstDayOfMonth(y, m) {
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function lastDayOfMonth(y, m) {
  const d = new Date(y, m + 1, 0);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getCurrentMonthRange() {
  const n = new Date();
  return { start: firstDayOfMonth(n.getFullYear(), n.getMonth()), end: lastDayOfMonth(n.getFullYear(), n.getMonth()) };
}

export default function PeriodFilter({ value, onChange, compact = false }) {
  const now = new Date();
  const [mode, setMode] = useState('month'); // 'month' | 'range'
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [start, setStart] = useState(value?.start || '');
  const [end, setEnd] = useState(value?.end || '');

  useEffect(() => {
    setStart(value?.start || '');
    setEnd(value?.end || '');
  }, [value?.start, value?.end]);

  const years = useMemo(() => {
    const list = [];
    for (let i = now.getFullYear(); i >= 2023; i--) list.push(i);
    return list;
  }, [now]);

  const applyMonth = (y = year, m = month) => {
    const s = firstDayOfMonth(y, m);
    const e = lastDayOfMonth(y, m);
    setStart(s); setEnd(e);
    onChange?.({ start: s, end: e });
  };

  const applyRange = () => {
    if (!start || !end) return;
    onChange?.({ start, end });
  };

  const setCurrentMonth = () => {
    setYear(now.getFullYear()); setMonth(now.getMonth());
    applyMonth(now.getFullYear(), now.getMonth());
  };

  return (
    <div
      className={`bg-white border border-border rounded-lg ${compact ? 'p-2' : 'p-3'} flex flex-wrap items-center gap-2`}
      data-testid="period-filter"
    >
      <Calendar className="w-4 h-4 text-brand-main" />
      <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setMode('month')}
          className={`px-3 py-1.5 font-semibold ${mode === 'month' ? 'bg-brand-main text-white' : 'bg-white text-txt-secondary hover:bg-bg-secondary'}`}
          data-testid="period-mode-month"
        >Mês/Ano</button>
        <button
          type="button"
          onClick={() => setMode('range')}
          className={`px-3 py-1.5 font-semibold ${mode === 'range' ? 'bg-brand-main text-white' : 'bg-white text-txt-secondary hover:bg-bg-secondary'}`}
          data-testid="period-mode-range"
        >Intervalo</button>
      </div>

      {mode === 'month' ? (
        <>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="h-8 px-2 text-xs bg-bg-secondary border border-border rounded-md font-semibold"
            data-testid="period-month-select"
          >
            {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="h-8 px-2 text-xs bg-bg-secondary border border-border rounded-md font-semibold"
            data-testid="period-year-select"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            type="button"
            onClick={() => applyMonth()}
            className="h-8 px-3 bg-brand-main text-white rounded-md text-xs font-bold hover:opacity-90"
            data-testid="period-apply-month"
          >Aplicar</button>
          <button
            type="button"
            onClick={setCurrentMonth}
            className="h-8 px-2 text-[11px] font-semibold text-txt-secondary hover:text-brand-main"
            data-testid="period-current-month"
          >Mês atual</button>
        </>
      ) : (
        <>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="h-8 px-2 text-xs bg-bg-secondary border border-border rounded-md"
            data-testid="period-range-start"
          />
          <span className="text-xs text-txt-secondary">até</span>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="h-8 px-2 text-xs bg-bg-secondary border border-border rounded-md"
            data-testid="period-range-end"
          />
          <button
            type="button"
            onClick={applyRange}
            disabled={!start || !end}
            className="h-8 px-3 bg-brand-main text-white rounded-md text-xs font-bold hover:opacity-90 disabled:opacity-50"
            data-testid="period-apply-range"
          >Aplicar</button>
        </>
      )}
    </div>
  );
}
