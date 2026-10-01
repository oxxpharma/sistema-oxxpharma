import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Loader2, Send, DollarSign, CheckCircle, FileText, CheckCircle2, Building2, Landmark, Clock, ExternalLink, Download } from 'lucide-react';
import { toast } from 'sonner';

function monthOptions() {
  const opts = [];
  const now = new Date();
  // Começa em +1 mês (para suportar o ciclo de corte pós dia 26)
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return opts;
}

export default function AdminCompanyBillings() {
  const [tab, setTab] = useState('empresa'); // 'empresa' | 'financeira'
  const [items, setItems] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'empresa') {
        const r = await api.get(`/api/admin/company-billings${period ? `?period=${period}` : ''}`);
        setItems(r.billings || []);
      } else {
        const r = await api.get(`/api/admin/convenio/financial-closing${period ? `?period=${period}` : ''}`);
        setFinancialData(r);
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period, tab]);

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

  const exportXLSX = async () => {
    try {
      const token = localStorage.getItem('token');
      const path = `/api/admin/convenio/financial-closing/export-xlsx${period ? `?period=${period}` : ''}`;
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao exportar relatório em Excel');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fechamento_financeira_${period || 'geral'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Relatório Excel exportado com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao exportar arquivo');
    }
  };

  const approveBilling = async (id) => {
    if (!window.confirm('Aprovar este fechamento empresarial e gerar cobrança automática via iPag/MercadoPago?')) return;
    try {
      const res = await api.post(`/api/admin/company-billings/${id}/approve`);
      toast.success('Fechamento aprovado com sucesso!');
      if (res.payment?.payment_url) {
        window.open(res.payment.payment_url, '_blank');
      }
      load();
    } catch (err) { toast.error(err.message); }
  };

  const createPayment = async (id) => {
    try {
      const r = await api.post(`/api/admin/company-billings/${id}/create-payment`);
      toast.success('Preferência de pagamento criada');
      if (r.payment_url) window.open(r.payment_url, '_blank');
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
          <h1 className="font-heading font-black text-3xl">Faturamento & Fechamentos Convênio</h1>
          <p className="text-sm text-txt-secondary">
            Gerencie os dois fechamentos: Faturamento Mensal das Empresas e Fechamento Integral da Financeira.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">Período Atual</option>
            {monthOptions().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button variant="outline" onClick={runClosing} loading={running}>Rodar Fechamento</Button>
        </div>
      </div>

      {/* Tabs para Selecionar o Tipo de Fechamento */}
      <div className="flex border-b border-border mb-6 gap-4">
        <button
          onClick={() => setTab('empresa')}
          className={`pb-3 font-heading font-bold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === 'empresa' ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          <Building2 className="w-4 h-4" /> 1. Fechamento Empresas (Faturas Mensais)
        </button>
        <button
          onClick={() => setTab('financeira')}
          className={`pb-3 font-heading font-bold text-sm border-b-2 flex items-center gap-2 transition ${
            tab === 'financeira' ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          <Landmark className="w-4 h-4" /> 2. Fechamento Financeira (Antecipação / Valor Integral)
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>
      ) : tab === 'empresa' ? (
        /* VISÃO 1: FECHAMENTO EMPRESAS (VALOR DAS PARCELAS DO MÊS) */
        <div className="grid gap-4">
          {items.map(b => (
            <div key={b.billing_id} className="bg-white border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <div className="font-heading font-black text-lg text-txt-primary flex items-center gap-2">
                    {b.company_name} <span className="text-xs font-semibold text-txt-secondary bg-bg-secondary px-2 py-0.5 rounded-full">· {b.period_month}</span>
                  </div>
                  <div className="text-xs text-txt-secondary">{b.company_email} · {b.charges_count} cobrança(s) de parcelas no mês</div>
                </div>
                <div className="text-right">
                  <div className="font-heading font-black text-2xl text-brand-main">R$ {b.total_amount.toFixed(2)}</div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {b.approved ? (
                      <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aprovado pelo Admin
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Pendente de Aprovação
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      b.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      b.status === 'awaiting_payment' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>{b.status}</span>
                  </div>
                </div>
              </div>

              {/* Detalhamento por funcionário */}
              <div className="text-xs bg-bg-secondary/70 rounded-xl p-3 space-y-1 border border-border/60">
                <div className="font-semibold text-txt-primary mb-1 border-b border-border pb-1">Resumo das Parcelas por Funcionário:</div>
                {(b.employees || []).map(e => (
                  <div key={e.employee_id} className="flex justify-between">
                    <span>{e.employee_name}</span>
                    <span className="font-semibold">R$ {e.total.toFixed(2)} ({e.orders?.length || 0} parcelas)</span>
                  </div>
                ))}
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2 flex-wrap pt-2">
                {!b.approved && b.status !== 'paid' && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveBilling(b.billing_id)}>
                    <CheckCircle2 className="w-4 h-4" /> Aprovar Fechamento & Faturar (iPag/MP)
                  </Button>
                )}

                {b.status !== 'paid' && (
                  <>
                    {b.payment_url ? (
                      <a href={b.payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-brand-main text-brand-main rounded-lg hover:bg-brand-main hover:text-white transition">
                        <DollarSign className="w-4 h-4" /> Abrir Link de Pagamento <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => createPayment(b.billing_id)}>
                        <DollarSign className="w-4 h-4" /> Gerar Cobrança iPag/MP
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => resendEmail(b.billing_id)}>
                      <Send className="w-4 h-4" /> Reenviar E-mail
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => markPaid(b.billing_id)}>
                      <CheckCircle className="w-4 h-4" /> Marcar Pago Manualmente
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="p-10 text-center text-txt-secondary bg-white rounded-xl border border-border">
              Nenhum faturamento de empresa encontrado para este período.
            </div>
          )}
        </div>
      ) : (
        /* VISÃO 2: FECHAMENTO FINANCEIRA (VALOR INTEGRAL PARA ANTECIPAÇÃO) */
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-1">
                  Relatório de Antecipação de Recebíveis (Financeira)
                </div>
                <div className="text-3xl font-heading font-black">
                  R$ {(financialData?.grand_total_integral || 0).toFixed(2)}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Valor total integral das compras realizadas no período {financialData?.period || period || 'Geral'} ({financialData?.purchases_count || 0} pedidos)
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button onClick={exportXLSX} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">
                  <Download className="w-4 h-4 mr-2" /> Exportar XLSX
                </Button>
                <div className="text-right text-xs text-slate-300 max-w-xs">
                  Utilizado para operação de factoring/antecipação junto à instituição financeira parceira.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary border-b border-border font-bold">
                <tr>
                  <th className="p-4">Empresa / CNPJ</th>
                  <th className="p-4">Funcionário / CPF</th>
                  <th className="p-4">Pedido / Data</th>
                  <th className="p-4 text-center">Parcelas</th>
                  <th className="p-4 text-right">Valor Integral</th>
                  <th className="p-4 text-right">Cronograma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(financialData?.purchases || []).map(p => (
                  <tr key={p.purchase_id} className="hover:bg-bg-secondary/30 transition">
                    <td className="p-4">
                      <div className="font-bold text-txt-primary">{p.company_name}</div>
                      <div className="text-xs text-txt-secondary font-mono">{p.company_cnpj}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-txt-primary">{p.employee_name}</div>
                      <div className="text-xs text-txt-secondary font-mono">{p.employee_cpf ? `CPF: ${p.employee_cpf}` : ''}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-txt-primary">#{p.order_id ? p.order_id.slice(-8).toUpperCase() : p.purchase_id}</div>
                      <div className="text-xs text-txt-secondary">{p.created_at ? p.created_at.slice(0, 10) : ''}</div>
                    </td>
                    <td className="p-4 text-center font-semibold">
                      {p.total_installments}x
                    </td>
                    <td className="p-4 text-right font-heading font-black text-brand-main text-base">
                      R$ {p.purchase_total.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-xs">
                      <div className="flex flex-col items-end gap-1">
                        {(p.installments_schedule || []).map(inst => (
                          <span key={inst.charge_id} className="text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {inst.installment_number}/{p.total_installments} · R$ {inst.amount.toFixed(2)} ({inst.due_period_month})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!financialData?.purchases || financialData.purchases.length === 0) && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-txt-secondary">
                      Nenhuma compra realizada no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
