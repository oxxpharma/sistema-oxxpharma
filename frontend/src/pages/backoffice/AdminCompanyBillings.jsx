import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Loader2, Send, DollarSign, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

function monthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return opts;
}

export default function AdminCompanyBillings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/admin/company-billings${period ? `?period=${period}` : ''}`);
      setItems(r.billings || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  const runClosing = async () => {
    if (!window.confirm('Rodar fechamento manual? Isso agrupa todas as compras não faturadas em cobranças por empresa.')) return;
    setRunning(true);
    try {
      const r = await api.post('/api/admin/convenio/run-monthly-closing', period ? { period } : {});
      toast.success(`Fechamento OK: ${r.closed_companies} empresas · R$ ${r.total_amount.toFixed(2)}`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setRunning(false); }
  };

  const createPayment = async (id) => {
    try {
      const r = await api.post(`/api/admin/company-billings/${id}/create-payment`);
      toast.success('Preferência de pagamento criada');
      window.open(r.payment_url, '_blank');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const resendEmail = async (id) => {
    try {
      await api.post(`/api/admin/company-billings/${id}/resend-email`);
      toast.success('Email reenviado');
    } catch (err) { toast.error(err.message); }
  };

  const markPaid = async (id) => {
    if (!window.confirm('Marcar este faturamento como PAGO manualmente?')) return;
    try {
      await api.post(`/api/admin/company-billings/${id}/mark-paid`);
      toast.success('Marcado como pago');
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div data-testid="admin-company-billings">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-heading font-black text-3xl">Faturamento Convênio</h1>
          <p className="text-sm text-txt-secondary">Fechamentos mensais das empresas credenciadas · PIX/boleto via Mercado Pago</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os períodos</option>
            {monthOptions().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button variant="outline" onClick={runClosing} loading={running}>Rodar fechamento</Button>
        </div>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="grid gap-3">
          {items.map(b => (
            <div key={b.billing_id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <div className="font-heading font-black">{b.company_name} <span className="text-xs text-txt-secondary">· {b.period_month}</span></div>
                  <div className="text-xs text-txt-secondary">{b.company_email} · {b.charges_count} cobrança(s)</div>
                </div>
                <div className="text-right">
                  <div className="font-heading font-black text-2xl text-brand-main">R$ {b.total_amount.toFixed(2)}</div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    b.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                    b.status === 'awaiting_payment' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'}`}>{b.status}</span>
                </div>
              </div>
              <div className="text-xs bg-bg-secondary rounded p-2 mb-3">
                {(b.employees || []).map(e => (
                  <div key={e.employee_id} className="flex justify-between">
                    <span>{e.employee_name}</span>
                    <span className="font-semibold">R$ {e.total.toFixed(2)} ({e.orders?.length || 0} pedidos)</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {b.status !== 'paid' && (
                  <>
                    {b.payment_url ? (
                      <a href={b.payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold border border-brand-main text-brand-main rounded-lg hover:bg-brand-main hover:text-white">
                        <DollarSign className="w-4 h-4" /> Abrir link MP
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => createPayment(b.billing_id)}><DollarSign className="w-4 h-4" /> Gerar cobrança MP</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => resendEmail(b.billing_id)}><Send className="w-4 h-4" /> Reenviar email</Button>
                    <Button size="sm" variant="ghost" onClick={() => markPaid(b.billing_id)}><CheckCircle className="w-4 h-4" /> Marcar pago</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="p-10 text-center text-txt-secondary bg-white rounded-xl border border-border">Nenhum faturamento no período.</div>}
        </div>
      )}
    </div>
  );
}
