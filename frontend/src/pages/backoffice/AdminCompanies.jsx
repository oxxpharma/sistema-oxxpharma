import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Loader2, Search, Users, Building2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCompanies() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [d, list] = await Promise.all([
        api.get('/api/admin/convenio/dashboard').catch(() => null),
        api.get(`/api/admin/companies${search ? `?search=${encodeURIComponent(search)}` : ''}`),
      ]);
      setDash(d);
      setItems(list.companies || []);
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div data-testid="admin-companies">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary">Convênio · Empresas</h1>
          <p className="text-sm text-txt-secondary">Cadastro de empresas credenciadas, funcionários e convênio de desconto em folha.</p>
        </div>
        <Button onClick={() => nav('/backoffice/convenio/nova')} data-testid="new-company-btn"><Plus className="w-4 h-4" /> Nova empresa</Button>
      </div>

      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Building2} label="Empresas ativas" value={`${dash.companies.active}/${dash.companies.total}`} />
          <StatCard icon={Users} label="Funcionários ativos" value={`${dash.employees.active}/${dash.employees.total}`} />
          <StatCard icon={ShieldCheck} label="Cobranças em aberto" value={dash.open_charges} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-border p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-secondary" />
          <input className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm" placeholder="Buscar por nome, CNPJ ou email…"
            value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} data-testid="search-companies" />
        </div>
        <Button variant="outline" onClick={load}>Buscar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(c => (
            <Link key={c.company_id} to={`/backoffice/convenio/${c.company_id}`} className={`bg-white rounded-xl border border-border p-4 hover:border-brand-main transition ${!c.active ? 'opacity-70' : ''}`} data-testid={`company-card-${c.company_id}`}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <div className="font-heading font-black">{c.name}</div>
                {!c.active && <span className="text-[10px] font-bold uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inativa</span>}
                {c.payroll_enabled && <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Folha</span>}
              </div>
              <div className="text-xs text-txt-secondary">CNPJ: {c.cnpj || '—'}</div>
              <div className="text-xs text-txt-secondary">Email: {c.email}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-bg-secondary rounded p-2">
                  <div className="text-txt-secondary">Funcionários</div>
                  <div className="font-bold text-sm">{c.employees_count}</div>
                </div>
                <div className="bg-bg-secondary rounded p-2">
                  <div className="text-txt-secondary">Desconto</div>
                  <div className="font-bold text-sm">{(c.discount_percent || 0).toFixed(1)}%</div>
                </div>
              </div>
            </Link>
          ))}
          {items.length === 0 && <div className="col-span-full p-10 text-center text-txt-secondary bg-white rounded-xl border border-border">Nenhuma empresa cadastrada.</div>}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-brand-main/10 text-brand-main flex items-center justify-center"><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-xs text-txt-secondary">{label}</div>
        <div className="font-heading font-black text-lg">{value}</div>
      </div>
    </div>
  );
}
