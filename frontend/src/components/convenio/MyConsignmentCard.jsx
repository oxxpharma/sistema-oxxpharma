import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { CreditCard, Calendar, ShieldCheck, CheckCircle2, Clock, Info, AlertTriangle, ChevronRight, Building2, User, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function MyConsignmentCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/me/consignado-card');
      setData(res);
      if (res.statement && res.statement.length > 0) {
        setSelectedMonth(res.statement[0].period_month);
      }
    } catch (err) {
      // Se não for funcionário, silencia erro visual amigável
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-border shadow-sm">
        <div className="w-8 h-8 border-4 border-brand-main border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-txt-secondary">Carregando seu Cartão Consignado...</p>
      </div>
    );
  }

  if (!data || !data.card) {
    return null; // Não é funcionário de empresa credenciada
  }

  const { card, statement = [] } = data;
  const activeStatement = statement.find(s => s.period_month === selectedMonth) || statement[0];

  // Cálculo de percentuais de uso
  const marginPct = card.monthly_margin > 0 ? Math.min(100, (card.current_month_committed / card.monthly_margin) * 100) : 0;
  const totalLimitPct = card.total_limit > 0 ? Math.min(100, (card.total_unpaid_balance / card.total_limit) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="consignado-card-widget">
      {/* Visual Cartão Consignado */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white p-6 md:p-8 shadow-2xl border border-slate-800">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-brand-main/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
          {/* Header do Cartão */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Cartão Consignado OxxPharma
                </span>
              </div>
              <div className="text-xl font-heading font-black text-white mt-2 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                {card.company_name}
              </div>
            </div>
            <div className="w-12 h-9 bg-gradient-to-br from-amber-300 to-amber-500 rounded-lg shadow-md flex items-center justify-center border border-amber-200/50">
              <div className="w-8 h-6 border border-amber-800/30 rounded flex items-center justify-center">
                <div className="w-3 h-3 bg-amber-700/40 rounded-full" />
              </div>
            </div>
          </div>

          {/* Número do Cartão & Nome */}
          <div className="space-y-1">
            <div className="font-mono text-xl sm:text-2xl tracking-widest text-slate-200">
              {card.card_number_mock}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span className="font-semibold text-white uppercase">{card.employee_name}</span>
              {card.position && <span>{card.position}</span>}
            </div>
          </div>

          {/* Indicadores de Limites & Margem */}
          <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
            {/* Margem Mensal (30%) */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 backdrop-blur-sm">
              <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                <span className="font-medium">Margem Mensal (30% do salário)</span>
                <span className="font-bold text-emerald-400">{formatCurrency(card.monthly_margin)}</span>
              </div>
              <div className="text-lg font-heading font-black text-white">
                {formatCurrency(card.available_monthly_margin)}
                <span className="text-xs font-normal text-slate-400 ml-1">disponível</span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${marginPct > 90 ? 'bg-red-500' : marginPct > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${marginPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                <span>Comprometido: {formatCurrency(card.current_month_committed)}</span>
                <span>{marginPct.toFixed(0)}% usado</span>
              </div>
            </div>

            {/* Limite Acumulado Total (100%) */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 backdrop-blur-sm">
              <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                <span className="font-medium">Limite Total (100% do salário)</span>
                <span className="font-bold text-blue-400">{formatCurrency(card.total_limit)}</span>
              </div>
              <div className="text-lg font-heading font-black text-white">
                {formatCurrency(card.available_total_limit)}
                <span className="text-xs font-normal text-slate-400 ml-1">disponível</span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${totalLimitPct > 90 ? 'bg-red-500' : totalLimitPct > 70 ? 'bg-amber-400' : 'bg-blue-400'}`}
                  style={{ width: `${totalLimitPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                <span>Saldo Devedor: {formatCurrency(card.total_unpaid_balance)}</span>
                <span>{totalLimitPct.toFixed(0)}% usado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Informativo do Ciclo do Fechamento (Dia 26) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-amber-900 text-sm">Regras do Fechamento & Data de Corte (Dia 26)</div>
          <p>
            • Compras realizadas até o <strong>dia 26</strong> são faturadas na folha do mês atual.
          </p>
          <p>
            • Compras realizadas a partir do <strong>dia 27</strong> vencem no ciclo da folha do mês seguinte.
          </p>
          <p>
            • Ao quitar parcelas mensais, o seu limite mensal (30%) e total (100%) são <strong>recompostos automaticamente</strong> para novas compras.
          </p>
        </div>
      </div>

      {/* Extrato Mensal de Parcelas */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="font-heading font-black text-xl text-txt-primary flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-main" /> Extrato de Parcelas por Fatura
            </h2>
            <p className="text-xs text-txt-secondary">
              Acompanhe os vencimentos mês a mês em sua folha de pagamento
            </p>
          </div>

          {/* Selector de Meses */}
          {statement.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
              {statement.map(st => (
                <button
                  key={st.period_month}
                  onClick={() => setSelectedMonth(st.period_month)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedMonth === st.period_month
                      ? 'bg-brand-main text-white shadow-md'
                      : 'bg-bg-secondary text-txt-secondary hover:bg-border'
                  }`}
                >
                  {st.period_month} ({formatCurrency(st.total_due)})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabela de Itens da Fatura Selecionada */}
        {activeStatement && activeStatement.items.length > 0 ? (
          <div className="space-y-3">
            <div className="bg-bg-secondary/60 p-4 rounded-xl flex items-center justify-between border border-border">
              <div className="text-xs text-txt-secondary">
                Total a descontar na fatura <strong>{activeStatement.period_month}</strong>:
              </div>
              <div className="font-heading font-black text-lg text-brand-main">
                {formatCurrency(activeStatement.total_due)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-txt-secondary uppercase">
                    <th className="pb-2">Pedido / Compra</th>
                    <th className="pb-2">Parcela</th>
                    <th className="pb-2">Vencimento</th>
                    <th className="pb-2 text-right">Valor Parcela</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeStatement.items.map(ch => (
                    <tr key={ch.charge_id} className="hover:bg-bg-secondary/30 transition">
                      <td className="py-3 font-semibold text-txt-primary">
                        <div>Pedido #{ch.order_id ? ch.order_id.slice(-8).toUpperCase() : 'N/A'}</div>
                        <div className="text-[11px] font-normal text-txt-secondary">
                          Total compra: {formatCurrency(ch.purchase_total || ch.amount)}
                        </div>
                      </td>
                      <td className="py-3 text-txt-secondary font-medium">
                        {ch.installment_number || 1} / {ch.total_installments || 1}
                      </td>
                      <td className="py-3 text-txt-secondary">
                        {ch.due_period_month || ch.period_month}
                      </td>
                      <td className="py-3 text-right font-bold text-txt-primary">
                        {formatCurrency(ch.amount)}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          ch.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          ch.status === 'billed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {ch.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {ch.status === 'paid' ? 'Pago' : ch.status === 'billed' ? 'Faturado' : 'Aberto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-txt-secondary bg-bg-secondary/40 rounded-xl border border-dashed border-border">
            Nenhuma parcela pendente para este mês.
          </div>
        )}
      </div>
    </div>
  );
}
