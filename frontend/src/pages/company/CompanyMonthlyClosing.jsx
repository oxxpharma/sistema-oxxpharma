import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Loader2, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CompanyMonthlyClosing() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await api.get(`/api/company/reports/monthly?month=${month}`)); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  return (
    <div data-testid="company-closing">
      <h1 className="font-heading font-black text-3xl mb-1">Fechamento mensal</h1>
      <p className="text-sm text-txt-secondary mb-4">Compras dos funcionários por mês. Este relatório é enviado automaticamente para o email cadastrado da empresa no dia 1º.</p>

      <div className="bg-white border border-border rounded-xl p-4 mb-4 flex items-center gap-3 flex-wrap">
        <Calendar className="w-5 h-5 text-brand-main" />
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm" data-testid="month-input" />
        <Button variant="outline" onClick={load}>Atualizar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div>
          <div className="bg-white rounded-xl border border-border p-4 mb-4 flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-xs text-txt-secondary">Total do mês</div>
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
