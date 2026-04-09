import React, { useState, useEffect } from 'react';
import { useAuth, LEVEL_NAMES } from '../contexts/AuthContext';
import AppLayout, { StatCard, DashCard } from '../components/layout/AppLayout';
import { formatCurrency } from '../lib/utils';
import {
  Users, DollarSign, ShoppingBag, Wallet, TrendingUp, Copy, Clock,
  MapPin, Building2, Globe2, Store, Link2, ArrowUpCircle, Package
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function AdminDashboard({ data }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Usuarios" value={data?.total_users || 0} color="orange" />
        <StatCard icon={ShoppingBag} label="Pedidos do Mes" value={data?.month_orders || 0} color="green" />
        <StatCard icon={DollarSign} label="Receita Mensal" value={formatCurrency(data?.month_revenue || 0)} color="amber" />
        <StatCard icon={Clock} label="Comissoes Pendentes" value={formatCurrency(data?.pending_commissions || 0)} color="red" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard title="Usuarios por Nivel" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.users_by_level ? Object.entries(data.users_by_level).map(([k, v]) => ({ name: k, total: v })) : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fill: '#4B5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: 12 }} />
                <Bar dataKey="total" fill="#E8731A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
        <DashCard title="Top Comissoes" noPadding>
          <div className="divide-y divide-border">
            {(data?.top_sellers || []).map((s, idx) => (
              <div key={idx} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-bg-secondary text-txt-secondary'}`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{s.name}</p>
                  <p className="text-xs text-txt-secondary">{s.level}</p>
                </div>
                <span className="text-sm font-bold text-brand-main">{formatCurrency(s.total)}</span>
              </div>
            ))}
            {(!data?.top_sellers || data.top_sellers.length === 0) && (
              <div className="p-8 text-center text-txt-secondary text-sm">Sem dados</div>
            )}
          </div>
        </DashCard>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Wallet} label="Saques Pendentes" value={data?.pending_withdrawals || 0} color="purple" />
        <StatCard icon={TrendingUp} label="Total Pedidos" value={data?.total_orders || 0} color="green" />
        <StatCard icon={Globe2} label="Receita Total" value={formatCurrency(data?.month_revenue || 0)} color="orange" />
      </div>
    </>
  );
}

function EstadualDashboard({ data, user }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Saldo Disponivel" value={formatCurrency(data?.available_balance || 0)} color="green" />
        <StatCard icon={DollarSign} label="Comissoes do Mes" value={formatCurrency(data?.month_commissions || 0)} color="orange" />
        <StatCard icon={MapPin} label="Regionais" value={data?.regionais_count || 0} color="purple" />
        <StatCard icon={Store} label="Cidades/Unidades" value={data?.cidades_count || 0} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title={`Estado: ${data?.state || user?.state || '-'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Regionais</p>
              <p className="text-2xl font-heading font-bold text-brand-main mt-1">{data?.regionais_count || 0}</p>
            </div>
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Unidades Cidade</p>
              <p className="text-2xl font-heading font-bold text-brand-main mt-1">{data?.cidades_count || 0}</p>
            </div>
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Indicadores</p>
              <p className="text-2xl font-heading font-bold text-violet-600 mt-1">{data?.indicadores_count || 0}</p>
            </div>
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Receita do Estado</p>
              <p className="text-2xl font-heading font-bold text-accent-green mt-1">{formatCurrency(data?.state_revenue || 0)}</p>
            </div>
          </div>
        </DashCard>
        <ReferralCard user={user} />
      </div>
      <BalanceRow data={data} />
    </>
  );
}

function RegionalDashboard({ data, user }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Saldo Disponivel" value={formatCurrency(data?.available_balance || 0)} color="green" />
        <StatCard icon={DollarSign} label="Comissoes do Mes" value={formatCurrency(data?.month_commissions || 0)} color="orange" />
        <StatCard icon={Store} label="Unidades (Cidades)" value={data?.cidades_count || 0} color="amber" />
        <StatCard icon={Users} label="Indicadores" value={data?.indicadores_count || 0} color="purple" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title={`Regiao DDD: ${data?.ddd || user?.ddd || '-'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Unidades</p>
              <p className="text-2xl font-heading font-bold text-brand-main mt-1">{data?.cidades_count || 0}</p>
            </div>
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Receita Regional</p>
              <p className="text-2xl font-heading font-bold text-accent-green mt-1">{formatCurrency(data?.region_revenue || 0)}</p>
            </div>
          </div>
        </DashCard>
        <ReferralCard user={user} />
      </div>
      <BalanceRow data={data} />
    </>
  );
}

function CidadeDashboard({ data, user }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Saldo Disponivel" value={formatCurrency(data?.available_balance || 0)} color="green" />
        <StatCard icon={DollarSign} label="Comissoes do Mes" value={formatCurrency(data?.month_commissions || 0)} color="orange" />
        <StatCard icon={Users} label="Indicadores" value={data?.indicadores_count || 0} color="purple" />
        <StatCard icon={ShoppingBag} label="Vendas do Mes" value={data?.month_unit_orders || 0} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Desempenho da Unidade">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Indicadores Ativos</p>
              <p className="text-2xl font-heading font-bold text-brand-main mt-1">{data?.indicadores_count || 0}</p>
            </div>
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Receita Mensal</p>
              <p className="text-2xl font-heading font-bold text-accent-green mt-1">{formatCurrency(data?.month_unit_revenue || 0)}</p>
            </div>
          </div>
        </DashCard>
        <ReferralCard user={user} />
      </div>
      <BalanceRow data={data} />
    </>
  );
}

function IndicadorDashboard({ data, user }) {
  const navigate = useNavigate();
  const progress = data?.progress_percent || (data?.can_upgrade !== undefined
    ? Math.min(100, Math.round((data.total_referrals / Math.max(1, data.min_referrals_upgrade)) * 100))
    : 0);
  const canUpgrade = data?.can_upgrade;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Saldo Disponivel" value={formatCurrency(data?.available_balance || 0)} color="green" />
        <StatCard icon={Clock} label="Saldo Bloqueado" value={formatCurrency(data?.blocked_balance || 0)} color="amber" />
        <StatCard icon={Users} label="Total Indicacoes" value={data?.total_referrals || data?.direct_referrals || 0} color="purple" />
        <StatCard icon={DollarSign} label="Comissoes do Mes" value={formatCurrency(data?.month_commissions || 0)} color="orange" />
      </div>

      {/* Upgrade Progress */}
      <DashCard title="Progresso para Unidade Indicadora" action={
        canUpgrade ? (
          <button onClick={() => navigate('/upgrade')}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-green text-white text-xs font-bold rounded-md hover:bg-green-600 transition-all"
            data-testid="upgrade-btn">
            <ArrowUpCircle className="w-4 h-4" /> Fazer Upgrade
          </button>
        ) : null
      }>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-txt-secondary">Indicacoes: {data?.total_referrals || data?.direct_referrals || 0} / {data?.min_referrals_upgrade || 20}</span>
              <span className="text-sm font-bold text-brand-main">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-bg-secondary rounded-full overflow-hidden border border-border">
              <div className="h-full bg-brand-main rounded-full transition-all duration-500" style={{ width: `${progress}%` }} data-testid="upgrade-progress" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-txt-secondary">Investimento necessario</p>
              <p className="text-lg font-heading font-bold text-txt-primary">{formatCurrency(data?.investment_needed || 500)}</p>
            </div>
            {canUpgrade && (
              <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-md">
                <p className="text-xs font-semibold text-green-700">Voce atingiu o minimo de indicacoes!</p>
              </div>
            )}
          </div>
        </div>
      </DashCard>

      <ReferralCard user={user} />
    </>
  );
}

function UnidadeIndicadoraDashboard({ data, user }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Saldo Disponivel" value={formatCurrency(data?.available_balance || 0)} color="green" />
        <StatCard icon={DollarSign} label="Total Comissoes" value={formatCurrency(data?.total_commissions || 0)} color="orange" />
        <StatCard icon={Users} label="Indicacoes" value={data?.total_referrals || data?.direct_referrals || 0} color="purple" />
        <StatCard icon={TrendingUp} label="Comissoes do Mes" value={formatCurrency(data?.month_commissions || 0)} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Seu Desempenho">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Indicacoes Ativas</p>
              <p className="text-2xl font-heading font-bold text-brand-main mt-1">{data?.total_referrals || data?.direct_referrals || 0}</p>
            </div>
            <div className="p-4 bg-bg-secondary rounded-md border border-border text-center">
              <p className="text-xs text-txt-secondary font-medium">Total Ganho</p>
              <p className="text-2xl font-heading font-bold text-accent-green mt-1">{formatCurrency(data?.total_commissions || 0)}</p>
            </div>
          </div>
        </DashCard>
        <ReferralCard user={user} />
      </div>
      <BalanceRow data={data} />
    </>
  );
}

function ReferralCard({ user }) {
  const copy = () => navigator.clipboard.writeText(`${window.location.origin}/store?ref=${user?.referral_code}`);
  return (
    <DashCard title="Seu Codigo de Indicacao">
      <div className="flex items-center gap-4">
        <div className="flex-1 px-4 py-3 bg-bg-secondary rounded-md border border-border">
          <code className="text-sm font-mono font-bold text-brand-main" data-testid="referral-code">{user?.referral_code}</code>
        </div>
        <button onClick={copy} className="flex items-center gap-2 px-4 py-3 bg-brand-main text-white rounded-md text-sm font-semibold hover:bg-brand-hover transition-all" data-testid="copy-referral-btn">
          <Copy className="w-4 h-4" /> Copiar Link
        </button>
      </div>
    </DashCard>
  );
}

function BalanceRow({ data }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <DashCard title="Saldo Bloqueado">
        <p className="text-2xl font-heading font-bold text-amber-500">{formatCurrency(data?.blocked_balance || 0)}</p>
        <p className="text-xs text-txt-secondary mt-1">Comissoes aguardando liberacao</p>
      </DashCard>
      <DashCard title="Total Pedidos">
        <p className="text-2xl font-heading font-bold text-txt-primary">{data?.total_orders || 0}</p>
        <p className="text-xs text-txt-secondary mt-1">Pedidos realizados</p>
      </DashCard>
    </div>
  );
}

export default function DashboardPage() {
  const { user, token, accessLevel } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const endpoint = accessLevel <= 1 ? '/api/dashboard/admin' : '/api/dashboard/user';
      const res = await fetch(`${API_URL}${endpoint}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" />
        </div>
      </AppLayout>
    );
  }

  const levelSubtitles = {
    0: 'Visao geral do sistema',
    1: 'Visao geral do sistema',
    2: `Estadual - ${user?.state || ''}`,
    3: `Regional - DDD ${user?.ddd || ''}`,
    4: `Unidade - ${user?.city || ''}`,
    5: 'Indicador',
    6: 'Unidade Indicadora',
  };

  return (
    <AppLayout title={`Ola, ${user?.name?.split(' ')[0]}!`} subtitle={levelSubtitles[accessLevel] || LEVEL_NAMES[accessLevel]}>
      <div className="space-y-6 fade-in" data-testid="dashboard-content">
        {accessLevel <= 1 && <AdminDashboard data={data} />}
        {accessLevel === 2 && <EstadualDashboard data={data} user={user} />}
        {accessLevel === 3 && <RegionalDashboard data={data} user={user} />}
        {accessLevel === 4 && <CidadeDashboard data={data} user={user} />}
        {accessLevel === 5 && <IndicadorDashboard data={data} user={user} />}
        {accessLevel === 6 && <UnidadeIndicadoraDashboard data={data} user={user} />}
      </div>
    </AppLayout>
  );
}
