import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  Zap, Target, Trophy, TrendingUp, Users, Save, RefreshCw, Loader2,
  Sparkles, Calendar, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts';

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function mk(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }

export default function AdminMultiplierCampaign() {
  const now = new Date();
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [statsMonth, setStatsMonth] = useState(mk(now.getFullYear(), now.getMonth()));
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // Local editable state for goals grid: { 'YYYY-MM': 'value_string' }
  const [goalsDraft, setGoalsDraft] = useState({});

  const yearList = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], [now]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, u] = await Promise.all([
        api.get('/api/admin/multiplier-campaign'),
        api.get(`/api/admin/multiplier-campaign/stats?month=${statsMonth}`),
        api.get(`/api/admin/multiplier-campaign/users?month=${statsMonth}&filter=${filter}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
      ]);
      setCfg(c); setStats(s); setUsers(u.users || []);
      setGoalsDraft(Object.fromEntries(Object.entries(c.goals || {}).map(([k, v]) => [k, String(v)])));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [statsMonth, filter, search]);

  useEffect(() => { load(); }, [load]);

  const saveCfg = async (patch) => {
    setSaving(true);
    try {
      const upd = await api.put('/api/admin/multiplier-campaign', patch);
      setCfg(upd);
      toast.success('Salvo');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const saveGoals = async () => {
    const cleaned = {};
    for (const [k, v] of Object.entries(goalsDraft)) {
      const n = Number(String(v).replace(',', '.'));
      if (!Number.isNaN(n) && n > 0) cleaned[k] = n;
    }
    await saveCfg({ goals: cleaned });
    await load();
  };

  const reprocess = async (month) => {
    setReprocessing(true);
    try {
      const r = await api.post(`/api/admin/multiplier-campaign/reprocess?month=${month}`);
      toast.success(`Mês ${r.month}: ${r.activated} ativados / ${r.deactivated} desativados`);
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setReprocessing(false); }
  };

  if (loading && !cfg) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!cfg) return null;

  const activePct = stats?.total_mmn_users ? Math.round((stats.active_count / stats.total_mmn_users) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="admin-multiplier-campaign">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
            <Zap className="w-8 h-8 text-brand-main" />
            Campanha do Multiplicador
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Multiplica a % de cashback das gerações 3-6 para quem bater a meta mensal de vendas na 1ª geração.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-border bg-white cursor-pointer" data-testid="campaign-enabled-toggle">
            <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => saveCfg({ enabled: e.target.checked })} className="w-4 h-4 accent-brand-main" />
            <span className="text-sm font-bold">{cfg.enabled ? 'ATIVA' : 'DESATIVADA'}</span>
          </label>
        </div>
      </div>

      {/* CONFIG */}
      <section className="bg-white border border-border rounded-xl p-5" data-testid="campaign-cfg-card">
        <h2 className="font-heading font-bold flex items-center gap-2 mb-3"><Sparkles className="w-5 h-5 text-brand-main" /> Configuração</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-txt-secondary block mb-1">Multiplicador</label>
            <input
              type="number" step="0.1" min="1" max="20"
              defaultValue={cfg.value}
              onBlur={(e) => { const v = Number(e.target.value); if (v !== cfg.value) saveCfg({ value: v }); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-lg font-heading font-black text-brand-main"
              data-testid="campaign-multiplier-input"
            />
            <p className="text-[11px] text-txt-secondary mt-1">Ex.: 2.0 dobra o cashback das gerações 3-6.</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-txt-secondary block mb-1">Início da campanha</label>
            <input
              type="date"
              defaultValue={cfg.started_at || ''}
              onBlur={(e) => { if (e.target.value !== cfg.started_at) saveCfg({ started_at: e.target.value }); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-semibold"
              data-testid="campaign-started-input"
            />
            <p className="text-[11px] text-txt-secondary mt-1">Mês {cfg.start_month || '—'}: todos entram ativados no bootstrap.</p>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={() => reprocess(statsMonth)}
              loading={reprocessing}
              variant="outline"
              data-testid="campaign-reprocess-btn"
            >
              <RefreshCw className="w-4 h-4" /> Reprocessar {statsMonth}
            </Button>
          </div>
        </div>
      </section>

      {/* METAS */}
      <section className="bg-white border border-border rounded-xl p-5" data-testid="campaign-goals-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold flex items-center gap-2"><Target className="w-5 h-5 text-emerald-600" /> Metas por mês</h2>
          <div className="flex items-center gap-2">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-2 py-1.5 border border-border rounded-md text-sm font-semibold bg-white" data-testid="campaign-year-select">
              {yearList.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button size="sm" onClick={saveGoals} loading={saving} data-testid="campaign-save-goals">
              <Save className="w-4 h-4" /> Salvar metas
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {MONTHS_PT.map((label, i) => {
            const key = mk(year, i);
            return (
              <div key={key} className="border border-border rounded-lg p-2" data-testid={`goal-${key}`}>
                <div className="text-[10px] uppercase font-bold text-txt-secondary">{label}</div>
                <input
                  type="number" step="0.01" min="0"
                  value={goalsDraft[key] ?? ''}
                  onChange={(e) => setGoalsDraft(d => ({ ...d, [key]: e.target.value }))}
                  placeholder="R$ 0,00"
                  className="w-full mt-1 px-2 py-1 border border-border rounded text-sm font-bold text-right"
                  data-testid={`goal-input-${key}`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-txt-secondary mt-2">
          Meta ausente → multiplicador desativa naquele mês (regra do cliente). Salve as metas para os próximos meses com antecedência.
        </p>
      </section>

      {/* STATS + FILTRO */}
      <section className="bg-white border border-border rounded-xl p-5" data-testid="campaign-stats-card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-heading font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-brand-main" /> Estatísticas</h2>
          <select value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} className="px-3 py-1.5 border border-border rounded-md text-sm font-semibold bg-white" data-testid="campaign-stats-month">
            {Array.from({ length: 12 }, (_, i) => mk(year, i)).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox icon={Users} label="Total MMN" value={stats?.total_mmn_users || 0} accent="text-txt-primary" testid="stat-total-mmn" />
          <StatBox icon={Zap} label="Multiplicador ativo" value={`${stats?.active_count || 0}`} hint={`${activePct}% da rede`} accent="text-brand-main" testid="stat-active" />
          <StatBox icon={Target} label="Bateram meta (mês ant.)" value={`${stats?.hit_last_month_count || 0}`} accent="text-emerald-600" testid="stat-hit" />
          <StatBox icon={Trophy} label="Meta do mês" value={formatCurrency(stats?.goal_current || 0)} accent="text-amber-600" testid="stat-goal" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          <div className="bg-bg-secondary rounded-xl p-4">
            <div className="text-xs font-bold uppercase text-txt-secondary mb-2">Progresso da rede — {statsMonth}</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={Object.entries(stats?.progress_buckets || {}).map(([k, v]) => ({ range: k, count: v }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef7f1a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-bg-secondary rounded-xl p-4">
            <div className="text-xs font-bold uppercase text-txt-secondary mb-2">Ativações mês a mês</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={(stats?.history || []).map(h => ({ month: h._id, ativos: h.count }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="ativos" stroke="#ef7f1a" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {(stats?.top_streak || []).length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-bold uppercase text-txt-secondary mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Top sequências</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {stats.top_streak.map((t, i) => (
                <div key={t.user_id} className="bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs text-amber-900 font-bold">#{i + 1}</div>
                  <div className="text-sm font-black truncate">{t.name || '—'}</div>
                  <div className="text-[11px] text-amber-800 truncate">{t.email}</div>
                  <div className="mt-1 text-emerald-700 font-black">{t.streak_months} {t.streak_months === 1 ? 'mês' : 'meses'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* TABELA USUARIOS */}
      <section className="bg-white border border-border rounded-xl p-5" data-testid="campaign-users-card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-heading font-bold flex items-center gap-2"><Users className="w-5 h-5 text-brand-main" /> Usuários</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
              {[
                { k: 'all', l: 'Todos' },
                { k: 'active', l: 'Ativos' },
                { k: 'inactive', l: 'Inativos' },
                { k: 'hit', l: 'Bateram meta' },
              ].map(t => (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setFilter(t.k)}
                  className={`px-3 py-1.5 font-semibold ${filter === t.k ? 'bg-brand-main text-white' : 'bg-white text-txt-secondary hover:bg-bg-secondary'}`}
                  data-testid={`filter-${t.k}`}
                >{t.l}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 border border-border rounded-md px-2 py-1 bg-white">
              <Search className="w-4 h-4 text-txt-secondary" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou e-mail" className="outline-none text-sm w-40" data-testid="users-search" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-txt-secondary text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Usuário</th>
                <th className="px-3 py-2 text-left">Rede</th>
                <th className="px-3 py-2 text-right">Vendas Gen1</th>
                <th className="px-3 py-2 text-right">Meta</th>
                <th className="px-3 py-2 text-center">Bateu?</th>
                <th className="px-3 py-2 text-center">Streak</th>
                <th className="px-3 py-2 text-center">Multi</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-border hover:bg-bg-secondary/40" data-testid={`user-row-${u.user_id}`}>
                  <td className="px-3 py-2">
                    <div className="font-bold">{u.name}</div>
                    <div className="text-[11px] text-txt-secondary">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {u.network_type === 'network_1' ? <Badge variant="brand">Equipe 1</Badge> : u.network_type === 'network_2' ? <Badge variant="success">Equipe 2</Badge> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(u.sales_gen1 || 0)}</td>
                  <td className="px-3 py-2 text-right text-txt-secondary">{formatCurrency(u.goal || 0)}</td>
                  <td className="px-3 py-2 text-center">
                    {u.hit_goal ? <Badge variant="success">Sim</Badge> : <Badge variant="default">Não</Badge>}
                  </td>
                  <td className="px-3 py-2 text-center font-bold">{u.streak_months || 0}</td>
                  <td className="px-3 py-2 text-center">
                    {u.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="default">Inativo</Badge>}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-txt-secondary text-sm">Nenhum usuário para o filtro selecionado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, hint, accent, testid }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4" data-testid={testid}>
      <Icon className={`w-5 h-5 mb-2 ${accent || 'text-brand-main'}`} />
      <div className="text-xl font-heading font-black">{value}</div>
      <div className="text-[11px] text-txt-secondary mt-0.5">{label}</div>
      {hint && <div className="text-[10px] text-txt-secondary/80">{hint}</div>}
    </div>
  );
}
