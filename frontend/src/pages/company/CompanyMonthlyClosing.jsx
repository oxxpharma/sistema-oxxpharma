import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Loader2, Calendar, CreditCard, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CompanyMonthlyClosing() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [reportRes, billingsRes] = await Promise.all([
        api.get(`/api/company/reports/monthly?month=${month}`),
        api.get(`/api/company/billings`).catch(() => ({ billings: [] }))
      ]);
      setData(reportRes);
      setBillings(billingsRes.billings || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const currentBilling = billings.find(b => b.period_month === month);

  const handlePayBilling = async (billingId) => {
    setPaying(true);
    try {
      const res = await api.post(`/api/company/billings/${billingId}/pay`);
      if (res.payment_url) {
        toast.success("Redirecionando para o pagamento via MercadoPago...");
        window.open(res.payment_url, "_blank");
      } else {
        toast.error("Falha ao obter URL de pagamento.");
      }
      load();
    } catch (err) {
      toast.error(err.message || "Erro ao gerar cobrança");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div data-testid="company-closing">
      <h1 className="font-heading font-black text-3xl mb-1">Fechamento mensal</h1>
      <p className="text-sm text-txt-secondary mb-4">Compras dos funcionários por mês. Faturas consolidadas de desconto em folha podem ser pagas diretamente via MercadoPago (PIX/Boleto).</p>

      <div className="bg-white border border-border rounded-xl p-4 mb-4 flex items-center gap-3 flex-wrap">
        <Calendar className="w-5 h-5 text-brand-main" />
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm" data-testid="month-input" />
        <Button variant="outline" onClick={load}>Atualizar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div>
          {/* Card da Fatura Fechada do Mês */}
          {currentBilling && (
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Fatura de Fechamento do Mês ({currentBilling.period_month})</div>
                  <div className="text-3xl font-heading font-black text-white">R$ {(currentBilling.total_amount || 0).toFixed(2)}</div>
                  <div className="text-xs text-slate-300 mt-1">Refere-se a {currentBilling.charges_count} cobranças de funcionários</div>
                </div>

                <div className="flex items-center gap-3">
                  {currentBilling.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Fatura Paga
                    </span>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-lg text-xs font-bold">
                        <Clock className="w-4 h-4 text-amber-400" /> Aguardando Pagamento
                      </span>
                      {currentBilling.payment_url ? (
                        <a href={currentBilling.payment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-brand-main hover:bg-brand-hover text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all">
                          <CreditCard className="w-4 h-4" /> Pagar via MercadoPago <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <Button onClick={() => handlePayBilling(currentBilling.billing_id)} loading={paying} className="bg-brand-main hover:bg-brand-hover text-white">
                          <CreditCard className="w-4 h-4" /> Gerar Pagamento MercadoPago
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-border p-4 mb-4 flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-xs text-txt-secondary">Total de compras do mês</div>
              <div className="font-heading font-black text-3xl text-brand-main">R$ {(data?.grand_total || 0).toFixed(2)}</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <div className="text-xs text-txt-secondary">Funcionários com compras</div>
              <div className="font-heading font-black text-2xl">{data?.employees?.length || 0}</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <div className="text-xs text-txt-secondary">Total de pedidos</div>
              <div className="font-heading font-black text-2xl">{data?.count || 0}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left px-3 py-2">Funcionário</th>
                  <th className="text-right px-3 py-2">Nº pedidos</th>
                  <th className="text-right px-3 py-2">Total mês</th>
                </tr>
              </thead>
              <tbody>
                {(data?.employees || []).map(e => (
                  <tr key={e.employee_id} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">{e.employee_name}</td>
                    <td className="px-3 py-2 text-right">{e.count}</td>
                    <td className="px-3 py-2 text-right font-bold text-brand-main">R$ {e.total.toFixed(2)}</td>
                  </tr>
                ))}
                {(!data?.employees || data.employees.length === 0) && <tr><td colSpan="3" className="p-6 text-center text-txt-secondary">Nenhuma compra no mês selecionado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
