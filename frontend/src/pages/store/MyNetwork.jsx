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
  ChevronDown, ChevronRight,
} from 'lucide-react';

const NETWORK_LABELS = {
  customer: { label: 'Indicador', color: 'default' },
  network_1: { label: 'Equipe 1 - Corporativo', color: 'brand' },
  network_2: { label: 'Equipe 2 - Propagandista', color: 'success' },
};

export default function MyNetwork() {
  const { user } = useAuth(); // eslint-disable-line no-unused-vars
  const [data, setData] = useState(null);
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
      const d = await api.get(url);
      setData(d);
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
            label="Indicações diretas"
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
