import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Loader2, DollarSign, User } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await api.get('/api/company/reports/open-charges')); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="company-reports">
      <h1 className="font-heading font-black text-3xl mb-4">Relatório · Cobranças em aberto</h1>
      <p className="text-sm text-txt-secondary mb-4">Compras feitas pelos funcionários com "Desconto em folha" que ainda não foram fechadas.</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-txt-secondary">Total em aberto</div>
          <div className="font-heading font-black text-2xl text-brand-main">R$ {(data?.total || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-txt-secondary">Cobranças</div>
          <div className="font-heading font-black text-2xl">{data?.count || 0}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
            <tr>
              <th className="text-left px-3 py-2">Funcionário</th>
              <th className="text-left px-3 py-2">Pedido</th>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-right px-3 py-2">Valor</th>
              <th className="text-center px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.charges || []).map(c => (
              <tr key={c.charge_id || c.order_id} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">{c.employee_name}</td>
                <td className="px-3 py-2 text-xs">{c.order_id}</td>
                <td className="px-3 py-2 text-txt-secondary">{c.created_at?.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right">R$ {(c.amount || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${c.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{c.status}</span>
                </td>
              </tr>
            ))}
            {(!data?.charges || data.charges.length === 0) && <tr><td colSpan="5" className="p-6 text-center text-txt-secondary">Nenhuma cobrança em aberto.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
