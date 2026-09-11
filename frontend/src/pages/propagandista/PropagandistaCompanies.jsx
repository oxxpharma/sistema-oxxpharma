import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { Loader2, Building2, Users, Percent, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function PropagandistaCompanies() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/propagandista/me');
      setData(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="w-8 h-8 animate-spin inline text-brand-main" />
      </div>
    );
  }

  const companies = data?.companies || [];

  return (
    <div data-testid="propagandista-companies">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl">Minhas Empresas</h1>
          <p className="text-sm text-txt-secondary mt-1">
            Empresas do seu convênio · você recebe 5% da compra dos funcionários e 15% quando a empresa comprar direto
          </p>
        </div>
        <Button onClick={() => navigate('/propagandista/empresas/nova')} data-testid="create-company-btn">
          <Plus className="w-4 h-4 mr-1" /> Cadastrar empresa
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={Building2} label="Empresas ativas" value={data?.total_companies || 0} accent />
        <Stat icon={Users} label="Funcionários cadastrados" value={data?.total_employees || 0} />
      </div>

      {companies.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Building2 className="w-10 h-10 mx-auto text-amber-500 mb-2" />
          <div className="font-heading font-black text-lg text-amber-900">Você ainda não tem empresas vinculadas</div>
          <p className="text-sm text-amber-800 mt-1 mb-3">
            Cadastre a sua primeira empresa parceira do convênio para começar a receber comissões.
          </p>
          <Button onClick={() => navigate('/propagandista/empresas/nova')}>
            <Plus className="w-4 h-4 mr-1" /> Cadastrar minha primeira empresa
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="p-3 text-left">Empresa</th>
                <th className="p-3 text-left">CNPJ</th>
                <th className="p-3 text-center">Funcionários</th>
                <th className="p-3 text-center">Desconto</th>
                <th className="p-3 text-left">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.company_id} className="border-t border-border hover:bg-bg-secondary/40" data-testid={`company-row-${c.company_id}`}>
                  <td className="p-3">
                    <div className="font-semibold text-txt-primary">{c.name}</div>
                    <div className="text-xs text-txt-secondary">{c.email || '—'}</div>
                  </td>
                  <td className="p-3 font-mono text-xs text-txt-primary">{c.cnpj || '—'}</td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                      <Users className="w-3 h-3" /> {c.employees_count || 0}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {c.employee_discount_pct > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                        <Percent className="w-3 h-3" /> {c.employee_discount_pct}% ao funcionário
                      </span>
                    ) : (
                      <span className="text-xs text-txt-secondary">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-txt-secondary">{c.created_at?.slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-900">
        <div className="font-semibold mb-1">Como funciona o Convênio</div>
        <ul className="list-disc list-inside space-y-0.5 text-sky-800 text-[13px]">
          <li>Quando um <b>funcionário</b> compra: Empresa recebe 15% · <b>Você (Propagandista)</b> recebe 5% · Líder da Rede 1%</li>
          <li>Quando a <b>empresa</b> compra: <b>Você (Propagandista)</b> recebe 15% · Líder da Rede 5%</li>
          <li>Se a empresa optou por dar % de desconto pro funcionário, a comissão dela cai; a sua permanece 5%</li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent = false }) {
  return (
    <div className={`rounded-2xl p-5 border ${accent ? 'bg-gradient-to-br from-brand-main to-brand-hover text-white border-transparent shadow-lg shadow-brand-main/20' : 'bg-white border-border'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent ? 'bg-white/20' : 'bg-brand-light text-brand-main'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-heading font-black mt-3">{value}</div>
      <div className={`text-xs ${accent ? 'text-white/80' : 'text-txt-secondary'}`}>{label}</div>
    </div>
  );
}
