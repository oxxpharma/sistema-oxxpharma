import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import PeriodFilter, { getCurrentMonthRange } from '../../components/PeriodFilter';
import {
  Network, Users, DollarSign, ShoppingBag, Loader2, Award, TrendingUp, Share2,
  ChevronDown, ChevronRight, Wallet, Zap, Info, Target, X,
} from 'lucide-react';

const NETWORK_LABELS = {
  customer: { label: 'Indicador', color: 'default' },
  network_1: { label: 'Equipe 1 - Corporativo', color: 'brand' },
  network_2: { label: 'Equipe 2 - Propagandista', color: 'success' },
};

export default function MyNetwork() {
  const { user } = useAuth(); // eslint-disable-line no-unused-vars
  const [data, setData] = useState(null);
  const [multiplier, setMultiplier] = useState(null); // Iter 54
  const [showCampaignInfo, setShowCampaignInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const initial = getCurrentMonthRange();
  const [period, setPeriod] = useState(initial);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (p?.start) q.set('start', p.start);
      if (p?.end) q.set('end', p.end);
      const url = q.toString() ? `/api/users/me/network?${q}` : '/api/users/me/network';
      const [d, m] = await Promise.all([
        api.get(url),
        api.get('/api/users/me/multiplier').catch(() => null),
      ]);
      setData(d);
      setMultiplier(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(initial); /* eslint-disable-next-line */ }, []);

  if (loading && !data) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!data) return null;

  const isCustomer = data.network_type === 'customer';
  const label = NETWORK_LABELS[data.network_type] || NETWORK_LABELS.customer;

  // Total de membros em toda a rede (independe do periodo)
  const totalMembers = data.generations.reduce((acc, g) => acc + (g.members_count || 0), 0);
  // Iter 49: totais agregados do periodo
  const totalReceived = data.generations.reduce((acc, g) => acc + (g.received_total || 0), 0);
  const totalPurchases = data.generations.reduce((acc, g) => acc + (g.purchases_total || 0), 0);

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
            Se indicar muitas pessoas com frequência, o admin pode te promover a <strong>Propagandista</strong> e ativar o sistema Equipe para você ganhar em até 6 gerações.
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
            <Network className="w-8 h-8 text-brand-main" /> Minha Equipe
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={label.color}>{label.label}</Badge>
            <span className="text-xs text-txt-secondary">Código: <span className="font-mono font-bold">{data.referral_code}</span></span>
          </div>
        </div>
        <Link to="/indique-ganhe">
          <Button variant="outline"><Share2 className="w-4 h-4" /> Compartilhar link</Button>
        </Link>
      </div>

      {/* Iter 49: filtro de periodo — default mes atual */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <PeriodFilter
          value={period}
          onChange={(p) => { setPeriod(p); load(p); }}
        />
        <div className="text-xs text-txt-secondary">
          Exibindo dados de <b>{period.start}</b> até <b>{period.end}</b>
        </div>
      </div>

      {/* Iter 51: Saldo Total Disponivel — INDEPENDENTE do filtro de periodo.
          Aparece com destaque acima das KPIs para nao gerar duvida quando o
          usuario muda o mes ("achei que meu saldo sumiu"). */}
      <div
        className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-5 flex items-center justify-between gap-4 shadow-sm"
        data-testid="kpi-account-balance"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase font-bold tracking-wider opacity-80">Saldo total disponível</div>
            <div className="text-3xl md:text-4xl font-heading font-black leading-tight">
              {formatCurrency(data.account_balance || 0)}
            </div>
            <div className="text-[11px] opacity-80 mt-0.5">
              Valor acumulado na sua conta · ainda não enviado ao cartão · não depende do período
            </div>
          </div>
        </div>
      </div>

      {/* Iter 54: Multiplier campaign card */}
      {multiplier && multiplier.campaign_enabled && (
        <MultiplierCard m={multiplier} onInfo={() => setShowCampaignInfo(true)} />
      )}

      {showCampaignInfo && (
        <CampaignInfoModal m={multiplier} onClose={() => setShowCampaignInfo(false)} />
      )}

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-gradient-to-br from-brand-main to-brand-hover text-white rounded-xl p-5">
          <TrendingUp className="w-6 h-6 mb-2 opacity-80" />
          <div className="text-2xl font-heading font-black" data-testid="kpi-total-received">{formatCurrency(totalReceived)}</div>
          <div className="text-xs opacity-80 mt-0.5">Valor recebido no período</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <ShoppingBag className="w-6 h-6 text-emerald-500 mb-2" />
          <div className="text-2xl font-heading font-black" data-testid="kpi-total-purchases">{formatCurrency(totalPurchases)}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Total de compras da rede</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <DollarSign className="w-6 h-6 text-emerald-500 mb-2" />
          <div className="text-2xl font-heading font-black">{formatCurrency(data.totals.paid)}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Já pago (do total recebido)</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <Users className="w-6 h-6 text-brand-main mb-2" />
          <div className="text-2xl font-heading font-black">{totalMembers}</div>
          <div className="text-xs text-txt-secondary mt-0.5">Membros na rede</div>
        </div>
      </div>

      {/* Iter 35 (refeito 42m): Breakdown por origem.
          Mostra "Indicacoes diretas" + apenas a Equipe que o user faz parte
          (Equipe 1 OU 2 — nao ambos). */}
      {data.by_source && (
        <div className="grid sm:grid-cols-2 gap-3 mb-8" data-testid="commissions-by-source">
          <SourceCard
            label="Consumidor Final"
            sub="Cashback gerado por compras no meu link"
            data={data.by_source.affiliate || {}}
            color="from-emerald-500/10 to-emerald-500/5 text-emerald-700 border-emerald-200"
          />
          {data.network_type === 'network_1' && (
            <SourceCard
              label="Equipe"
              data={data.by_source.network_1 || {}}
              color="from-brand-main/15 to-brand-main/5 text-brand-main border-brand-main/30"
            />
          )}
          {data.network_type === 'network_2' && (
            <SourceCard
              label="Equipe"
              data={data.by_source.network_2 || {}}
              color="from-sky-500/10 to-sky-500/5 text-sky-700 border-sky-200"
            />
          )}
        </div>
      )}

      {/* Iter 50: Top 3 compradores do periodo */}
      {(data.top_buyers || []).length > 0 && (
        <div className="mb-6" data-testid="top-buyers">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="font-heading font-black text-lg">Top 3 do período</h2>
            <span className="text-xs text-txt-secondary">Maiores compradores da sua rede</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.top_buyers.map((m, idx) => {
              const medal = ['from-amber-400 to-orange-500', 'from-slate-300 to-slate-500', 'from-orange-400 to-amber-600'][idx] || 'from-brand-main to-brand-hover';
              return (
                <div
                  key={m.user_id}
                  className="relative bg-white rounded-xl border border-border p-4 overflow-hidden"
                  data-testid={`top-buyer-${idx + 1}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${medal}`} />
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-black text-white shrink-0 bg-gradient-to-br ${medal}`}>
                      {idx + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{m.name || '(sem nome)'}</div>
                      <div className="text-[11px] text-txt-secondary">
                        {m.generation}ª geração · {m.purchases_count} {m.purchases_count === 1 ? 'pedido' : 'pedidos'}
                      </div>
                      <div className="mt-2 font-heading font-black text-lg text-emerald-600">
                        {formatCurrency(m.purchases_total || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gerações com lista nominal */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-heading font-black text-xl">Minhas gerações (até 6 níveis)</h2>
          <p className="text-xs text-txt-secondary mt-1">
            Você recebe cashback de toda a sua linha de indicados — direta e indireta — até a 6ª geração.
            Clique em cada geração para ver os membros.
          </p>
        </div>

        <div className="divide-y divide-border">
          {data.generations.map(g => {
            const isExp = !!expanded[g.generation];
            const isEmpty = (g.members_count || 0) === 0;
            return (
              <div key={g.generation} data-testid={`gen-row-${g.generation}`}>
                <button
                  type="button"
                  disabled={isEmpty}
                  onClick={() => !isEmpty && setExpanded({ ...expanded, [g.generation]: !isExp })}
                  className={`w-full flex items-center gap-3 p-4 text-left transition ${isEmpty ? 'opacity-60 cursor-default' : 'hover:bg-bg-secondary/40'}`}
                  data-testid={`gen-toggle-${g.generation}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-black text-sm shrink-0 ${g.generation === 1 ? 'bg-brand-main text-white' : 'bg-brand-light text-brand-main'}`}>
                    {g.generation}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{g.generation}ª geração</div>
                    <div className="text-xs text-txt-secondary">
                      {g.members_count} {g.members_count === 1 ? 'membro' : 'membros'} · taxa <span className="font-semibold">{g.rate_pct}%</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-right text-xs">
                    <div className="text-emerald-600 font-semibold" data-testid={`gen-${g.generation}-received`}>
                      Valor recebido: {formatCurrency(g.received_total || 0)}
                    </div>
                    <div className="text-brand-main font-semibold" data-testid={`gen-${g.generation}-purchases`}>
                      Total das compras: {formatCurrency(g.purchases_total || 0)}
                    </div>
                  </div>
                  {!isEmpty && (
                    isExp
                      ? <ChevronDown className="w-4 h-4 text-brand-main shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-txt-secondary shrink-0" />
                  )}
                </button>
                {isExp && !isEmpty && (
                  <div className="bg-bg-secondary/40 px-4 pb-4 pt-1">
                    <ul className="bg-white border border-border rounded-lg divide-y divide-border">
                      {(g.members || []).map((m, mi) => {
                        const netLabel = m.network_type === 'network_1' ? 'Equipe 1'
                          : m.network_type === 'network_2' ? 'Equipe 2' : null;
                        const purchases = m.purchases_total || 0;
                        return (
                          <li key={m.user_id} className="flex items-center justify-between gap-3 p-3 text-sm" data-testid={`gen-${g.generation}-member-${m.user_id}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-brand-light text-brand-main font-bold text-xs flex items-center justify-center shrink-0">
                                {mi < 3 && purchases > 0 ? (
                                  <span className="text-amber-600">{mi + 1}º</span>
                                ) : (
                                  m.name?.[0]?.toUpperCase() || '?'
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold truncate flex items-center gap-2">
                                  {m.name || '(sem nome)'}
                                  {mi === 0 && purchases > 0 && (
                                    <Award className="w-3.5 h-3.5 text-amber-500" data-testid={`gen-${g.generation}-top`} />
                                  )}
                                </div>
                                <div className="text-xs text-txt-secondary truncate">
                                  {m.email || '—'}
                                  {m.created_at && <> · entrou em {formatDateTime(m.created_at).split(' ')[0]}</>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="text-[10px] uppercase font-bold text-txt-secondary/70">Compras no período</div>
                                <div
                                  className={`text-sm font-heading font-black ${purchases > 0 ? 'text-emerald-600' : 'text-txt-secondary/60'}`}
                                  data-testid={`gen-${g.generation}-member-${m.user_id}-purchases`}
                                >
                                  {formatCurrency(purchases)}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {netLabel && <Badge variant="brand">{netLabel}</Badge>}
                                {m.referral_program_active && <Badge variant="success">Programa ativo</Badge>}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                      {(g.members || []).length === 0 && (
                        <li className="p-3 text-xs text-txt-secondary">Nenhum membro detalhado disponível.</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ label, sub, data, color }) {
  const total = (data.paid || 0) + (data.pending || 0);
  return (
    <div className={`rounded-xl border p-4 bg-gradient-to-br ${color}`}>
      <div className="text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
      {sub && <div className="text-[11px] opacity-70 mb-3">{sub}</div>}
      <div className={`font-heading font-black text-2xl ${sub ? '' : 'mt-2'}`}>{formatCurrency(total)}</div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div>
          <div className="opacity-70">Recebido</div>
          <div className="font-bold">{formatCurrency(data.paid || 0)}</div>
        </div>
        <div>
          <div className="opacity-70">Pendente</div>
          <div className="font-bold">{formatCurrency(data.pending || 0)}</div>
        </div>
      </div>
      <div className="text-[10px] opacity-60 mt-2">{data.count || 0} cashbacks</div>
    </div>
  );
}


// ==================== Iter 54: componentes da campanha multiplicador ====================

function MultiplierCard({ m, onInfo }) {
  const goal = Number(m.goal_current_month || 0);
  const sales = Number(m.sales_gen1_current_month || 0);
  const pct = Number(m.progress_pct || 0);
  const remaining = Math.max(0, goal - sales);

  if (m.active) {
    return (
      <div
        className="mb-4 rounded-2xl border-2 border-amber-500/60 bg-slate-900 text-white p-5 shadow-xl overflow-hidden relative"
        data-testid="multiplier-active-card"
      >
        {/* glow decorativo */}
        <div className="absolute -right-10 -top-10 w-56 h-56 bg-amber-500/25 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -left-16 bottom-0 w-40 h-40 bg-orange-500/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute right-4 top-4 opacity-10">
          <Zap className="w-32 h-32 text-amber-400" strokeWidth={1.5} />
        </div>

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-[11px] uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                <Zap className="w-3.5 h-3.5 fill-slate-900" /> MULTIPLICADOR {m.multiplier_value}x ATIVO
              </span>
              {m.streak_months > 0 && (
                <span className="text-[11px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-full px-2.5 py-0.5 font-bold">
                  {m.streak_months} {m.streak_months === 1 ? 'mês seguido' : 'meses seguidos'}
                </span>
              )}
            </div>
            <div className="text-xl md:text-2xl font-heading font-black leading-tight text-white">
              Suas gerações 3-6 estão pagando <span className="text-amber-400">{m.multiplier_value}x mais</span> este mês!
            </div>
            <div className="text-sm text-slate-300 mt-1.5">
              {m.hit_goal_last_month
                ? <>Você bateu a meta no mês passado (<b className="text-white">{formatCurrency(m.sales_gen1_last_month)}</b> de {formatCurrency(m.goal_last_month)}).</>
                : 'Bônus de boas-vindas — bata a meta este mês para continuar no próximo!'}
            </div>
          </div>
          <button
            type="button"
            onClick={onInfo}
            className="shrink-0 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 p-2 transition"
            title="Como funciona a campanha"
            data-testid="multiplier-info-btn"
          >
            <Info className="w-4 h-4 text-white" />
          </button>
        </div>
        {goal > 0 && <ProgressStrip pct={pct} sales={sales} goal={goal} remaining={remaining} tone="on-dark" />}
      </div>
    );
  }
  // Inactive card — informativo/motivacional
  return (
    <div className="mb-4 rounded-2xl border border-border bg-white p-5 shadow-sm" data-testid="multiplier-inactive-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-brand-main" />
            <span className="font-heading font-bold">Campanha do multiplicador {m.multiplier_value}x</span>
            {m.streak_months > 0 && <Badge variant="success">{m.streak_months} meses de sequência</Badge>}
          </div>
          <div className="text-sm text-txt-secondary">
            {goal > 0
              ? <>Bata a meta deste mês para ativar o multiplicador em {nextMonthLabel(m.month)}.</>
              : <>A campanha está pausada para este mês (sem meta configurada).</>}
          </div>
        </div>
        <button type="button" onClick={onInfo} className="shrink-0 text-txt-secondary hover:text-brand-main" title="Como funciona" data-testid="multiplier-info-btn">
          <Info className="w-4 h-4" />
        </button>
      </div>
      {goal > 0 && <ProgressStrip pct={pct} sales={sales} goal={goal} remaining={remaining} tone="neutral" />}
    </div>
  );
}

function ProgressStrip({ pct, sales, goal, remaining, tone }) {
  const isDark = tone === 'on-dark';
  const isAmber = tone === 'on-amber';
  const bar = isDark ? 'bg-gradient-to-r from-amber-400 to-orange-500' : isAmber ? 'bg-white' : 'bg-brand-main';
  const track = isDark ? 'bg-white/10 border border-white/10' : isAmber ? 'bg-white/25' : 'bg-bg-secondary';
  const text = isDark || isAmber ? 'text-white' : 'text-txt-primary';
  const subtle = isDark ? 'text-slate-300' : isAmber ? 'text-white/90' : 'text-txt-secondary';
  const strong = isDark ? 'text-amber-300' : 'text-white';
  return (
    <div className={`mt-4 ${text}`}>
      <div className="flex items-baseline justify-between text-xs mb-1.5">
        <span className={`font-bold ${subtle}`}>Vendas da 1ª geração no mês: <b className="text-white">{formatCurrency(sales)}</b></span>
        <span className={`font-black ${strong} text-sm`}>{pct.toFixed(1)}%</span>
      </div>
      <div className={`w-full h-3 rounded-full ${track} overflow-hidden`}>
        <div
          className={`h-full ${bar} transition-all shadow-[0_0_10px_rgba(251,191,36,0.4)]`}
          style={{ width: `${Math.min(100, pct)}%` }}
          data-testid="multiplier-progress"
        />
      </div>
      <div className={`mt-1.5 text-[11px] ${subtle}`}>
        Meta: <b className="text-white">{formatCurrency(goal)}</b>
        {remaining > 0
          ? <> · Faltam <b className={strong}>{formatCurrency(remaining)}</b> para atingir</>
          : <> · <b className={strong}>META ATINGIDA!</b> 🎯</>}
      </div>
    </div>
  );
}

function nextMonthLabel(mk) {
  if (!mk) return 'o próximo mês';
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function CampaignInfoModal({ m, onClose }) {
  if (!m) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="campaign-info-modal">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            <h2 className="font-heading font-black text-xl">Como funciona a campanha</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-bg-secondary rounded-full" data-testid="campaign-info-close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <InfoBlock title={`Multiplicador ${m.multiplier_value}x`} icon={Zap}>
            Quando ativado, sua cashback nas <b>gerações 3, 4, 5 e 6</b> é multiplicada por <b>{m.multiplier_value}</b>. As gerações 1 e 2 continuam com a porcentagem normal.
          </InfoBlock>
          <InfoBlock title="Como ativar" icon={Target}>
            Bata a <b>meta de vendas da 1ª geração</b> no mês. A meta é a soma dos pedidos pagos dos seus indicados diretos. Se você atingir, o multiplicador acende <b>no mês seguinte</b>.
          </InfoBlock>
          <InfoBlock title="Bônus do 1º mês" icon={Award}>
            No primeiro mês da campanha, <b>todo mundo</b> já entra com o multiplicador ativo — é o presente de boas-vindas. Só depois é que passa a depender da meta.
          </InfoBlock>
          <InfoBlock title="Quando desativa">
            Se você <b>não bater a meta</b> em um mês, o multiplicador cai no mês seguinte. Pode reativar quando bater a meta de novo — sem penalidade.
          </InfoBlock>
          <div className="p-3 bg-bg-secondary rounded-lg text-xs text-txt-secondary">
            <b>Aplicabilidade:</b> apenas comissões criadas <i>enquanto o multiplicador está ativo</i>. Não recalcula histórico.
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1 font-bold text-txt-primary">
        {Icon && <Icon className="w-4 h-4 text-brand-main" />} {title}
      </div>
      <div className="text-txt-secondary text-sm leading-relaxed pl-6">{children}</div>
    </div>
  );
}
