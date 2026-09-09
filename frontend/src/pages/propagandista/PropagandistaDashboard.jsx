import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Loader2, Building2, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PropagandistaDashboard() {
  const [data, setData] = useState(null);
  const [comm, setComm] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [me, c] = await Promise.all([
          api.get('/api/propagandista/me'),
          api.get(`/api/propagandista/commissions?month=${month}`),
        ]);
        setData(me);
        setComm(c);
      } catch (err) { toast.error(err.message); }
      finally { setLoading(false); }
    })();
  }, [month]);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="propagandista-dashboard">
      <h1 className="font-heading font-black text-3xl mb-1">Olá, {data?.user?.name || 'Propagandista'}</h1>
      <p className="text-sm text-txt-secondary mb-6">Rede de convênios · comissões sobre compras dos funcionários (1ª geração) e indicações deles (2ª geração).</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={Building2} label="Empresas" value={data?.total_companies || 0} />
        <Stat icon={Users} label="Funcionários" value={data?.total_employees || 0} />
        <Stat icon={DollarSign} label="Comissão 1ª geração" value={`R$ ${(comm?.gen1_total || 0).toFixed(2)}`} accent="emerald" />
        <Stat icon={DollarSign} label="Comissão 2ª geração" value={`R$ ${(comm?.gen2_total || 0).toFixed(2)}`} accent="blue" />
      </div>

      <div className="bg-white rounded-xl border border-border p-4 mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-txt-secondary">Período:</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
            <tr>
              <th className="text-left px-3 py-2">Empresa</th>
              <th className="text-left px-3 py-2">Pedido</th>
              <th className="text-center px-3 py-2">Geração</th>
              <th className="text-right px-3 py-2">Base</th>
              <th className="text-right px-3 py-2">%</th>
              <th className="text-right px-3 py-2">Sua comissão</th>
              <th className="text-center px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(comm?.commissions || []).map(c => (
              <tr key={c.commission_id} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">{c.company_name}</td>
                <td className="px-3 py-2 text-xs">{c.order_id}</td>
                <td className="px-3 py-2 text-center">{c.generation}ª</td>
                <td className="px-3 py-2 text-right">R$ {c.base_amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{c.rate_percent}%</td>
                <td className="px-3 py-2 text-right font-bold text-brand-main">R$ {c.amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{c.status}</span>
                </td>
              </tr>
            ))}
            {(!comm?.commissions || comm.commissions.length === 0) && <tr><td colSpan="7" className="p-6 text-center text-txt-secondary">Nenhuma comissão no período.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent = 'brand' }) {
  const colors = { brand: 'bg-brand-main/10 text-brand-main', emerald: 'bg-emerald-100 text-emerald-700', blue: 'bg-blue-100 text-blue-700' };
  return (
    <div className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[accent]}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-xs text-txt-secondary">{label}</div>
        <div className="font-heading font-black text-lg">{value}</div>
      </div>
    </div>
  );
}
