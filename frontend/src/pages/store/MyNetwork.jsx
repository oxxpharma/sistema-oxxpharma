import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Network, Users, DollarSign, Clock, Loader2, Award, TrendingUp, Share2, Wallet } from 'lucide-react';

const NETWORK_LABELS = {
  customer: { label: 'Indicador', color: 'default' },
  network_1: { label: 'Rede 1 - Corporativo', color: 'brand' },
  network_2: { label: 'Rede 2 - Propagandista', color: 'success' },
};

export default function MyNetwork() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('/api/users/me/network');
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!data) return null;

  const isCustomer = data.network_type === 'customer';
  const label = NETWORK_LABELS[data.network_type] || NETWORK_LABELS.customer;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${origin}/?ref=${data.referral_code}`;

  // Total de membros em toda a rede
  const totalMembers = data.generations.reduce((acc, g) => acc + (g.members_count || 0), 0);

  if (isCustomer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" data-testid="my-network-customer">
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-brand-light flex items-center justify-center mb-4">
            <Award className="w-8 h-8 text-brand-main" />
          </div>
          <h1 className="font-heading font-black text-2xl">Você é um Indicador</h1>
          <p className="text-sm text-txt-secondary mt-2 max-w-md mx-auto">
            Por enquanto você ganha <strong>{Math.round(data.commission_rate_affiliate * 100)}%</strong> sobre toda compra feita através do seu link.
            Se indicar muitas pessoas com frequência, o admin pode te promover a <strong>Propagandista</strong> e ativar o sistema MMN para você ganhar em até 6 gerações.
          </p>
          <Link to="/indique-ganhe"><Button className="mt-6">Ver meu link de indicação</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" data-testid="my-network">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
            <Network className="w-8 h-8 text-brand-main" /> Minha Rede
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={label.color}>{label.label}</Badge>
            <span className="text-xs text-txt-secondary">Código: <span className="font-mono font-bold">{data.referral_code}</span></span>
          </div>
        </div>
        <Link to="/indique-ganhe">
          <Button variant="outline"><Share2 className="w-4 h-4" /> Compartilhar link</Button>
        </Link>
        <Link to="/meus-saques">
          <Button data-testid="go-withdrawals-btn"><Wallet className="w-4 h-4" /> Meus saques</Button>
        </Link>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-gradient-to-br from-brand-main to-brand-hover text-white rounded-xl p-5">
          <TrendingUp className="w-6 h-6 mb-2 opacity-80" />
          <div className="text-2xl font-heading font-black">{formatCurrency(data.totals.paid + data.totals.pending)}</div>
          <div className="text-xs opacity-80 mt-0.5">Ganhos totais (rede + afiliado)</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <DollarSign className="w-6 h-6 text-emerald-500 mb-2" />
          <div className="text-2xl font-heading font-black">{formatCurrency(data.totals.paid)}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Recebido</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <Clock className="w-6 h-6 text-amber-500 mb-2" />
          <div className="text-2xl font-heading font-black">{formatCurrency(data.totals.pending)}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Pendente</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <Users className="w-6 h-6 text-brand-main mb-2" />
          <div className="text-2xl font-heading font-black">{totalMembers}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Membros na rede</div>
        </div>
      </div>

      {/* Tabela de geracoes */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-heading font-black text-xl">Minhas gerações (até 6 níveis)</h2>
          <p className="text-xs text-txt-secondary mt-1">
            Comissões recebidas por geração. Taxa de afiliado 1ª compra: {Math.round(data.commission_rate_affiliate * 100)}%.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Geração</th>
                <th className="text-right p-3">Taxa</th>
                <th className="text-right p-3">Membros</th>
                <th className="text-right p-3">Nº de comissões</th>
                <th className="text-right p-3">Pendente</th>
                <th className="text-right p-3">Recebido</th>
              </tr>
            </thead>
            <tbody>
              {data.generations.map(g => (
                <tr key={g.generation} className="border-t border-border">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${g.generation === 1 ? 'bg-brand-main text-white' : 'bg-bg-secondary'}`}>
                        {g.generation}
                      </div>
                      <span className="font-semibold">{g.generation}ª geração</span>
                    </div>
                  </td>
                  <td className="p-3 text-right font-semibold">{g.rate_pct}%</td>
                  <td className="p-3 text-right">{g.members_count}</td>
                  <td className="p-3 text-right text-txt-secondary">{g.total_commissions}</td>
                  <td className="p-3 text-right text-amber-600 font-semibold">{formatCurrency(g.pending)}</td>
                  <td className="p-3 text-right text-emerald-600 font-semibold">{formatCurrency(g.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
