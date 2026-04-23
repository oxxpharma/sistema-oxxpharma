import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Award, TrendingUp, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCandidates() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/propaganda-candidates');
      setData(d);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const promote = async (userId) => {
    if (!window.confirm('Promover este usuário a Propagandista?')) return;
    setBusy(userId);
    try {
      await api.post(`/api/admin/users/${userId}/promote-to-propagandista`);
      toast.success('Usuário promovido!');
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-candidates">
      <div className="mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><Award className="w-7 h-7 text-brand-main" /> Candidatos a Propagandista</h1>
        <p className="text-sm text-txt-secondary mt-1">
          Clientes com ≥ <strong>{data.threshold}</strong> indicações nos últimos <strong>{data.period_days}</strong> dias.
        </p>
      </div>

      {(!data.candidates || data.candidates.length === 0) ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-txt-secondary">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-txt-secondary" />
          Nenhum candidato no momento. Ajuste o critério em Configurações para capturar mais ou menos usuários.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Usuário</th>
                <th className="text-left p-3">Email</th>
                <th className="text-right p-3">Indicações (período)</th>
                <th className="text-left p-3">Cód. indicação</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map(c => (
                <tr key={c.user_id} className="border-t border-border hover:bg-bg-secondary/50" data-testid={`candidate-${c.user_id}`}>
                  <td className="p-3 font-semibold">{c.name}</td>
                  <td className="p-3 text-txt-secondary">{c.email}</td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1 bg-brand-light text-brand-main font-bold px-2 py-1 rounded">
                      <TrendingUp className="w-3 h-3" /> {c.referrals_in_period}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">{c.referral_code}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" onClick={() => promote(c.user_id)} loading={busy === c.user_id} data-testid={`promote-${c.user_id}`}>
                      <Check className="w-4 h-4" /> Promover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
