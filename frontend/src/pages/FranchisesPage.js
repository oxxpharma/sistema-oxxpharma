import React, { useState, useEffect } from 'react';
import { useAuth, LEVEL_NAMES } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { Building2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FranchisesPage() {
  const { token } = useAuth();
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchFranchises(); }, []);

  const fetchFranchises = async () => {
    try {
      const res = await fetch(`${API_URL}/api/franchises`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setFranchises(d.franchises); }
    } catch {} finally { setLoading(false); }
  };

  if (loading) {
    return (
      <AppLayout title="Franquias">
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Franquias" subtitle="Visao geral das franquias por nivel e estado">
      <div className="space-y-6 fade-in">
        {franchises.length === 0 ? (
          <DashCard>
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-border mb-3" />
              <p className="text-txt-secondary">Nenhuma franquia registrada</p>
              <p className="text-xs text-txt-secondary mt-1">Cadastre usuarios nos niveis Estadual, Regional ou Cidade para ver aqui</p>
            </div>
          </DashCard>
        ) : (
          <div className="bg-white border border-border rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Nivel</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Estado</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Qtd</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Receita Total</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Valor Franquias</th>
                  </tr>
                </thead>
                <tbody>
                  {franchises.map((f, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-bg-secondary/50">
                      <td className="px-4 py-2.5 font-medium">{f.level_name}</td>
                      <td className="px-4 py-2.5 text-txt-secondary">{f.state || '-'}</td>
                      <td className="px-4 py-2.5 text-center">{f.count}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-brand-main">{formatCurrency(f.total_revenue)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(f.total_franchise_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
