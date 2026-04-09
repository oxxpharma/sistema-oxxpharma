import React, { useState, useEffect } from 'react';
import { useAuth, LEVEL_NAMES } from '../contexts/AuthContext';
import AppLayout, { StatCard, DashCard } from '../components/layout/AppLayout';
import { formatCurrency } from '../lib/utils';
import {
  Users, DollarSign, ShoppingBag, Wallet, TrendingUp,
  Copy, Clock, MapPin, Building2, Globe2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CHART_COLORS = ['#0047AB', '#10B981', '#F59E0B', '#8B5CF6', '#DC2626', '#6366F1', '#EC4899'];

export default function DashboardPage() {
  const { user, token, accessLevel } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const endpoint = accessLevel <= 1 ? '/api/dashboard/admin' : '/api/dashboard/user';
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/store?ref=${user?.referral_code}`;
    navigator.clipboard.writeText(link);
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

  const isAdmin = accessLevel <= 1;

  return (
    <AppLayout title={`Ola, ${user?.name?.split(' ')[0]}!`} subtitle={isAdmin ? 'Visao geral do sistema' : LEVEL_NAMES[accessLevel]}>
      <div className="space-y-6 fade-in">

        {/* Admin Dashboard */}
        {isAdmin && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Usuarios" value={data?.total_users || 0} color="blue" />
              <StatCard icon={ShoppingBag} label="Pedidos do Mes" value={data?.month_orders || 0} color="green" />
              <StatCard icon={DollarSign} label="Receita Mensal" value={formatCurrency(data?.month_revenue || 0)} color="amber" />
              <StatCard icon={Clock} label="Comissoes Pendentes" value={formatCurrency(data?.pending_commissions || 0)} color="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Users by Level */}
              <DashCard title="Usuarios por Nivel" className="lg:col-span-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={
                      data?.users_by_level
                        ? Object.entries(data.users_by_level).map(([k, v]) => ({ name: k, total: v }))
                        : []
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: 12 }} />
                      <Bar dataKey="total" fill="#0047AB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DashCard>

              {/* Top Sellers */}
              <DashCard title="Top Comissoes" noPadding>
                <div className="divide-y divide-border">
                  {(data?.top_sellers || []).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-bg-secondary text-txt-secondary'
                      }`}>
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

            {/* Pending Withdrawals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard icon={Wallet} label="Saques Pendentes" value={data?.pending_withdrawals || 0} color="purple" />
              <StatCard icon={TrendingUp} label="Total Pedidos" value={data?.total_orders || 0} color="green" />
              <StatCard icon={Globe2} label="Receita Total" value={formatCurrency(data?.month_revenue || 0)} color="blue" />
            </div>
          </>
        )}

        {/* User Dashboard */}
        {!isAdmin && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Wallet} label="Saldo Disponivel" value={formatCurrency(data?.available_balance || 0)} color="green" />
              <StatCard icon={Clock} label="Saldo Bloqueado" value={formatCurrency(data?.blocked_balance || 0)} color="amber" />
              <StatCard icon={DollarSign} label="Comissoes do Mes" value={formatCurrency(data?.month_commissions || 0)} color="blue" />
              <StatCard icon={Users} label="Indicacoes Diretas" value={data?.direct_referrals || 0} color="purple" />
            </div>

            {/* Referral Card */}
            <DashCard title="Seu Codigo de Indicacao">
              <div className="flex items-center gap-4">
                <div className="flex-1 px-4 py-3 bg-bg-secondary rounded-md border border-border">
                  <code className="text-sm font-mono font-bold text-brand-main" data-testid="referral-code">{user?.referral_code}</code>
                </div>
                <button
                  onClick={copyReferralLink}
                  className="flex items-center gap-2 px-4 py-3 bg-brand-main text-white rounded-md text-sm font-semibold hover:bg-brand-hover transition-all"
                  data-testid="copy-referral-btn"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Link
                </button>
              </div>
            </DashCard>

            {/* Location Info */}
            {(user?.state || user?.city) && (
              <DashCard title="Sua Area de Atuacao">
                <div className="flex flex-wrap gap-4">
                  {user?.state && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-md">
                      <MapPin className="w-4 h-4 text-brand-main" />
                      <span className="text-sm font-medium">Estado: {user.state}</span>
                    </div>
                  )}
                  {user?.ddd && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-md">
                      <Building2 className="w-4 h-4 text-brand-main" />
                      <span className="text-sm font-medium">DDD: {user.ddd}</span>
                    </div>
                  )}
                  {user?.city && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-md">
                      <Globe2 className="w-4 h-4 text-brand-main" />
                      <span className="text-sm font-medium">Cidade: {user.city}</span>
                    </div>
                  )}
                </div>
              </DashCard>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
