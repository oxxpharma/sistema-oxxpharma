import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { formatDateTime } from '../../lib/utils';
import { Award, Loader2, CheckCircle2, Clock } from 'lucide-react';

function fmtPoints(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? v.toLocaleString('pt-BR') : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function MyPoints() {
  const settings = useSiteSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const programName = settings?.referral_program_name || 'Programa de Benefícios';
  const pointsLabel = settings?.points_visibility_label || 'pontos';

  useEffect(() => {
    (async () => {
      try { setData(await api.get('/api/users/me/points')); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="my-points">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-2 flex items-center gap-3">
        <Award className="w-7 h-7 text-brand-main" /> Meus {pointsLabel}
      </h1>
      <p className="text-sm text-txt-secondary mb-6">
        Acompanhe os {pointsLabel} acumulados nas suas compras. Eles são creditados no {programName}.
      </p>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Total acumulado</div>
          <div className="text-3xl font-heading font-black mt-1" data-testid="my-points-total">{fmtPoints(data.total_points)}</div>
          <div className="text-xs opacity-80 mt-1">{pointsLabel}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Já enviados</div>
          <div className="text-3xl font-heading font-black text-emerald-900 mt-1" data-testid="my-points-sent">{fmtPoints(data.sent_total)}</div>
          <div className="text-xs text-emerald-700 mt-1">disponíveis no {programName}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pendentes</div>
          <div className="text-3xl font-heading font-black text-amber-900 mt-1" data-testid="my-points-pending">{fmtPoints(data.pending_total)}</div>
          <div className="text-xs text-amber-700 mt-1">aguardando processamento</div>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-bold text-lg">Histórico ({data.records_count})</h2>
        </div>
        {data.logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-txt-secondary">
            Você ainda não acumulou {pointsLabel}. Faça uma compra para começar!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-center p-3">Qtd.</th>
                  <th className="text-right p-3">{pointsLabel}</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-left p-3">Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map(l => (
                  <tr key={l.log_id} className="border-t border-border hover:bg-bg-secondary/40">
                    <td className="p-3 text-xs text-txt-secondary">{formatDateTime(l.registered_at)}</td>
                    <td className="p-3 text-xs">{l.product_name || l.order_id || '-'}</td>
                    <td className="p-3 text-center text-xs">{l.quantity || '-'}</td>
                    <td className="p-3 text-right font-bold">{fmtPoints(l.points_total)}</td>
                    <td className="p-3 text-center">
                      {l.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Enviado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-txt-secondary">{l.effective_sent_at ? formatDateTime(l.effective_sent_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
