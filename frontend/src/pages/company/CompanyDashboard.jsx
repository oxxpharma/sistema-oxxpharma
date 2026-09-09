import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Building2, Users, FileText, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyDashboard() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.get('/api/company/me');
        setCompany(c);
      } catch (err) { toast.error(err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!company) return <div className="p-10 text-center text-txt-secondary">Sem empresa vinculada.</div>;

  return (
    <div data-testid="company-dashboard">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-1">Olá, {company.name}</h1>
      <p className="text-sm text-txt-secondary mb-6">CNPJ: {company.cnpj} · Email de relatórios: {company.email}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users} label="Funcionários" value={company.employees_count || 0} />
        <StatCard icon={ShieldCheck} label="Desconto p/ funcionários" value={`${(company.discount_percent || 0).toFixed(1)}%`} />
        <StatCard icon={Building2} label="Desconto em folha" value={company.payroll_enabled ? 'Ativo' : 'Inativo'} accent={company.payroll_enabled ? 'emerald' : 'red'} />
        <StatCard icon={FileText} label="Limite consignado" value={`${(company.payroll_limit_percent || 0).toFixed(0)}%`} />
      </div>

      <div className="bg-white border border-border rounded-xl p-5 mb-4">
        <h2 className="font-heading font-black text-lg mb-2">Como funciona</h2>
        <ul className="text-sm text-txt-secondary space-y-2 list-disc pl-5">
          <li>Cadastre seus funcionários manualmente ou importe uma planilha XLSX.</li>
          <li>Os funcionários ganham automaticamente o desconto configurado ao comprar com o email cadastrado.</li>
          {company.payroll_enabled && <li>Eles podem escolher "Desconto em folha" no checkout, limitado a {company.payroll_limit_percent}% do salário.</li>}
          <li>No dia 1º do mês, você receberá o fechamento consolidado por email para descontar em folha.</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'brand' }) {
  const colors = {
    brand: 'bg-brand-main/10 text-brand-main',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-600',
  };
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
