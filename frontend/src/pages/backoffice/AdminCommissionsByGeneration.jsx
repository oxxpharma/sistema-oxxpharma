import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Loader2, Search, ChevronDown, ChevronRight, DollarSign, TrendingUp, Users, Package, Undo2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../../components/admin/Pagination';
import CommissionsStatusModal from '../../components/admin/CommissionsStatusModal';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_LIMIT = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'paid', label: 'Pagas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'pending_enrollment', label: 'Aguardando inscrição no programa' },
  { value: 'cancelled', label: 'Canceladas' },
];

const GEN_COLORS = ['#f97316', '#0ea5e9', '#22c55e', '#a855f7', '#ec4899', '#eab308', '#14b8a6'];
const NETWORK_COLORS = { network_1: '#f97316', network_2: '#0ea5e9', affiliate: '#a855f7', referral_sales: '#22c55e' };

export default function AdminCommissionsByGeneration() {
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('paid');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [page, setPage] = useState(1);
  const [statusModal, setStatusModal] = useState(null); // { mode: 'revert'|'approve', filters, title }

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (start) q.set('start', start);
      if (end) q.set('end', end);
      q.set('page', String(targetPage));
      q.set('limit', String(PAGE_LIMIT));
      const r = await api.get(`/api/admin/commissions-by-generation?${q}`);
      setData(r);
      setPage(r.page || targetPage);
      setExpanded(new Set()); // colapsa ao trocar pagina
    } catch (e) {
      toast.error(e?.message || 'Erro ao carregar');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);

  // Re-aplica filtros sempre volta pra pagina 1
  const applyFilters = () => load(1);

  const toggle = (id) => {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpanded(s);
  };

  // Agrupa o summary por geração (0..6) somando Equipe 1 + Equipe 2.
  // Iter 42m: tambem incorpora "Compras por Indicacao" (referral_sales_by_generation)
  // como serie paralela — NAO empilhada (mostra o que veio de link, sem duplicar
  // visualmente com Equipe 1/2).
  const chartData = useMemo(() => {
    if (!data?.summary_by_generation) return [];
    const byGen = new Map();
    for (const s of data.summary_by_generation) {
      const gen = s.generation ?? 0;
      if (!byGen.has(gen)) byGen.set(gen, { generation: gen, label: gen === 0 ? 'Afiliado' : `${gen}ª ger.`, network_1: 0, network_2: 0, affiliate: 0, referral_sales: 0, count: 0 });
      const row = byGen.get(gen);
      if (s.type === 'affiliate') row.affiliate += s.total_amount;
      else if (s.network_type === 'network_1') row.network_1 += s.total_amount;
      else if (s.network_type === 'network_2') row.network_2 += s.total_amount;
      row.count += s.count;
    }
    for (const r of (data.referral_sales_by_generation || [])) {
      const gen = r.generation ?? 0;
      if (!byGen.has(gen)) byGen.set(gen, { generation: gen, label: gen === 0 ? 'Afiliado' : `${gen}ª ger.`, network_1: 0, network_2: 0, affiliate: 0, referral_sales: 0, count: 0 });
      byGen.get(gen).referral_sales = r.total_amount || 0;
    }
    return Array.from(byGen.values()).sort((a, b) => a.generation - b.generation);
  }, [data]);

  const networkPie = useMemo(() => {
    if (!data?.summary_by_generation) return [];
    const totals = { affiliate: 0, network_1: 0, network_2: 0, referral_sales: 0 };
    for (const s of data.summary_by_generation) {
      if (s.type === 'affiliate') totals.affiliate += s.total_amount;
      else if (s.network_type === 'network_1') totals.network_1 += s.total_amount;
      else if (s.network_type === 'network_2') totals.network_2 += s.total_amount;
    }
    for (const r of (data.referral_sales_by_generation || [])) {
      totals.referral_sales += r.total_amount || 0;
    }
    return [
      { name: 'Afiliado Direto', value: totals.affiliate, color: NETWORK_COLORS.affiliate },
      { name: 'Equipe 1 (Corp.)', value: totals.network_1, color: NETWORK_COLORS.network_1 },
      { name: 'Equipe 2 (Prop.)', value: totals.network_2, color: NETWORK_COLORS.network_2 },
      { name: 'Compras por Indicação', value: totals.referral_sales, color: NETWORK_COLORS.referral_sales },
    ].filter(x => x.value > 0);
  }, [data]);

  return (
    <div className="space-y-6" data-testid="commissions-by-generation-page">
      <div>
        <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary">Cashback por Geração</h1>
        <p className="text-sm text-txt-secondary mt-1">Validação visual da cadeia MMN: quem recebeu, qual % e de qual geração (0 a 6).</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-txt-secondary block mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" data-testid="filter-status">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-txt-secondary block mb-1">De</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-txt-secondary block mb-1">Até</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" />
        </div>
        <Button variant="outline" onClick={applyFilters} data-testid="apply-filters"><Search className="w-4 h-4" /> Aplicar</Button>
        {isSuperAdmin && (
          <>
            {(status === 'pending' || status === '') && (
              <Button
                variant="outline"
                onClick={() => {
                  const f = {};
                  if (start) f.start = start;
                  if (end) f.end = end;
                  if (!start && !end) {
                    if (!window.confirm('Você não selecionou data. Isto aprovará TODAS as cashbacks pendentes. Continuar?')) return;
                  }
                  setStatusModal({ mode: 'approve', filters: f, title: 'Aprovar por filtro (em massa)' });
                }}
                data-testid="approve-by-filter-btn"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Aprovar por filtro
              </Button>
            )}
            {(status === 'paid' || status === 'paid_out' || status === '') && (
              <Button
                variant="outline"
                onClick={() => {
                  const f = { status_in: status === '' ? ['paid', 'paid_out'] : [status] };
                  if (start) f.start = start;
                  if (end) f.end = end;
                  if (!start && !end && status === '') {
                    if (!window.confirm('Você não selecionou data nem status. Isto reverterá TODAS as cashbacks pagas/saqueadas. Continuar?')) return;
                  }
                  setStatusModal({ mode: 'revert', filters: f, title: 'Reverter por filtro (em massa)' });
                }}
                data-testid="revert-by-filter-btn"
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <Undo2 className="w-4 h-4" /> Reverter por filtro
              </Button>
            )}
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>
      ) : !data ? null : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={DollarSign} color="emerald" label="Total pago" value={formatCurrency(data.totals.total_amount)} testId="total-amount" />
            <StatCard icon={TrendingUp} color="brand" label="Nº de cashbacks" value={data.totals.total_count} testId="total-count" />
            <StatCard icon={Package} color="indigo" label="Pedidos c/ cashback" value={data.totals.orders_with_commission} testId="total-orders" />
            <StatCard icon={Users} color="amber" label="Gerações ativas" value={chartData.filter(c => (c.affiliate + c.network_1 + c.network_2) > 0).length} testId="active-gens" />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
              <h2 className="font-heading font-black text-base mb-1">Total pago por geração</h2>
              <p className="text-xs text-txt-secondary mb-4">
                Barra empilhada = origem da hierarquia (Afiliado · Equipe 1 · Equipe 2).
                Barra verde ao lado = cashback gerado em <strong>compras por indicação</strong> (pedidos via link <code>?ref=</code>).
                Estes valores <strong>já estão somados</strong> em Equipe 1/2 — é uma visão paralela, não soma.
              </p>
              {chartData.length === 0 ? <EmptyHint msg="Sem cashbacks no período." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ left: 8, right: 8, top: 6, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="affiliate" stackId="a" fill={NETWORK_COLORS.affiliate} name="Afiliado Direto" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="network_1" stackId="a" fill={NETWORK_COLORS.network_1} name="Equipe 1" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="network_2" stackId="a" fill={NETWORK_COLORS.network_2} name="Equipe 2" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="referral_sales" stackId="r" fill={NETWORK_COLORS.referral_sales} name="Compras por Indicação" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-heading font-black text-base mb-4">Distribuição por origem</h2>
              {networkPie.length === 0 ? <EmptyHint msg="Sem cashbacks." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={networkPie} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${e.name}: ${formatCurrency(e.value)}`}>
                      {networkPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tabela de summary por geração */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-heading font-black text-base">Resumo por geração</h2>
              <p className="text-xs text-txt-secondary mt-1">% média aplicada, quantos usuários foram beneficiados e total pago.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="summary-table">
                <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                  <tr>
                    <th className="text-left p-3">Origem</th>
                    <th className="text-right p-3">% média</th>
                    <th className="text-right p-3">Beneficiários</th>
                    <th className="text-right p-3">Nº cashbacks</th>
                    <th className="text-right p-3">Total pago</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.summary_by_generation || []).length === 0
                    ? <tr><td colSpan={5} className="p-10 text-center text-txt-secondary">Sem dados.</td></tr>
                    : (data.summary_by_generation).map((s, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-3">
                            <div className="font-semibold flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.type === 'affiliate' ? NETWORK_COLORS.affiliate : NETWORK_COLORS[s.network_type] || '#999' }} />
                              {s.label}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">{s.avg_rate_pct.toFixed(2)}%</td>
                          <td className="p-3 text-right">{s.beneficiaries_count}</td>
                          <td className="p-3 text-right">{s.count}</td>
                          <td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(s.total_amount)}</td>
                        </tr>
                      ))}
                  {/* Iter 42m: linhas extras paralelas — Compras por Indicacao */}
                  {(data.referral_sales_by_generation || []).length > 0 && (
                    <tr className="border-t-2 border-emerald-200 bg-emerald-50/40">
                      <td colSpan={5} className="p-3 text-xs uppercase font-bold text-emerald-700 tracking-wider">
                        Compras por Indicação · cashbacks gerados por pedidos via link <code>?ref=</code> (já contabilizados acima)
                      </td>
                    </tr>
                  )}
                  {(data.referral_sales_by_generation || []).map((r, i) => (
                    <tr key={`rs-${i}`} className="border-t border-emerald-100 bg-emerald-50/20">
                      <td className="p-3">
                        <div className="font-semibold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: NETWORK_COLORS.referral_sales }} />
                          {r.generation === 0 ? 'Afiliado · Compras por Indicação' : `${r.generation}ª geração · Compras por Indicação`}
                        </div>
                        <div className="text-[11px] text-txt-secondary mt-0.5">{r.orders_count} pedidos via link</div>
                      </td>
                      <td className="p-3 text-right text-xs text-txt-secondary">—</td>
                      <td className="p-3 text-right">{r.beneficiaries_count}</td>
                      <td className="p-3 text-right">{r.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(r.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pedidos recentes com cadeia detalhada */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-heading font-black text-base">Últimos pedidos com cashbacks (validação detalhada)</h2>
              <p className="text-xs text-txt-secondary mt-1">Clique em um pedido para ver a cadeia completa de beneficiários (quem recebeu, qual geração, qual %).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="recent-orders-table">
                <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                  <tr>
                    <th className="w-8"></th>
                    <th className="text-left p-3">Pedido</th>
                    <th className="text-left p-3">Cliente</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-right p-3">Subtotal</th>
                    <th className="text-right p-3">Beneficiários</th>
                    <th className="text-right p-3">Cashbacks pagas</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recent_orders || []).length === 0
                    ? <tr><td colSpan={7} className="p-10 text-center text-txt-secondary">Nenhum pedido com cashback no período.</td></tr>
                    : data.recent_orders.map((o) => {
                      const isOpen = expanded.has(o.order_id);
                      return (
                        <React.Fragment key={o.order_id}>
                          <tr className="border-t border-border hover:bg-bg-secondary/40 cursor-pointer" onClick={() => toggle(o.order_id)} data-testid={`order-row-${o.order_id}`}>
                            <td className="p-3 text-txt-secondary">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                            <td className="p-3 font-mono text-xs">{o.order_number || o.order_id.slice(0, 12)}</td>
                            <td className="p-3">
                              <div className="font-semibold">{o.customer_name}</div>
                              <div className="text-xs text-txt-secondary">{o.customer_email}</div>
                            </td>
                            <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                            <td className="p-3 text-right font-mono">{formatCurrency(o.subtotal)}</td>
                            <td className="p-3 text-right">{o.chain.length}</td>
                            <td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(o.commission_total)}</td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-bg-secondary/30">
                              <td colSpan={7} className="p-0">
                                <div className="p-4">
                                  {isSuperAdmin && (
                                    <div className="flex justify-end gap-2 mb-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setStatusModal({
                                          mode: 'approve',
                                          filters: { order_ids: [o.order_id] },
                                          title: `Aprovar pedido ${o.order_number || o.order_id.slice(0, 12)}`,
                                        })}
                                        data-testid={`approve-order-${o.order_id}`}
                                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar pendentes do pedido
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => setStatusModal({
                                          mode: 'revert',
                                          filters: { order_ids: [o.order_id] },
                                          title: `Reverter pedido ${o.order_number || o.order_id.slice(0, 12)}`,
                                        })}
                                        data-testid={`revert-order-${o.order_id}`}
                                        className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                                      >
                                        <Undo2 className="w-3.5 h-3.5" /> Reverter pedido inteiro
                                      </Button>
                                    </div>
                                  )}
                                  <ChainTable
                                    chain={o.chain}
                                    subtotal={o.subtotal}
                                    isSuperAdmin={isSuperAdmin}
                                    onRevertOne={(c) => setStatusModal({
                                      mode: 'revert',
                                      filters: { commission_ids: [c.commission_id] },
                                      title: `Reverter cashback de ${c.beneficiary_name}`,
                                    })}
                                    onApproveOne={(c) => setStatusModal({
                                      mode: 'approve',
                                      filters: { commission_ids: [c.commission_id] },
                                      title: `Aprovar cashback de ${c.beneficiary_name}`,
                                    })}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                pages={data?.pages || 1}
                total={data?.total_orders || 0}
                limit={PAGE_LIMIT}
                onChange={(p) => load(p)}
                testId="orders-with-commission-pagination"
              />
            </div>
          </div>
        </>
      )}

      <CommissionsStatusModal
        open={!!statusModal}
        onClose={() => setStatusModal(null)}
        mode={statusModal?.mode}
        filters={statusModal?.filters}
        title={statusModal?.title}
        onSuccess={() => load(page)}
      />
    </div>
  );
}

function ChainTable({ chain, subtotal, isSuperAdmin, onRevertOne, onApproveOne }) {
  const gens = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold text-txt-secondary">Cadeia de cashbacks geradas por este pedido</div>
        <div className="flex items-center gap-2 flex-wrap">
          {gens.map(g => {
            const has = chain.some(c => (c.generation ?? 0) === g);
            return (
              <span
                key={g}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${has ? 'text-white' : 'text-txt-secondary bg-bg-secondary'}`}
                style={has ? { background: g === 0 ? NETWORK_COLORS.affiliate : GEN_COLORS[g % GEN_COLORS.length] } : {}}
                title={g === 0 ? 'Afiliado Direto' : `${g}ª geração`}
              >
                {g === 0 ? 'AFIL' : `G${g}`}
              </span>
            );
          })}
        </div>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-bg-secondary/70 text-[11px] uppercase text-txt-secondary">
          <tr>
            <th className="text-left p-2">Geração</th>
            <th className="text-left p-2">Beneficiário</th>
            <th className="text-left p-2">Rede</th>
            <th className="text-right p-2">% aplicado</th>
            <th className="text-right p-2">Base (subtotal)</th>
            <th className="text-right p-2">Valor recebido</th>
            <th className="text-center p-2">Status</th>
            {isSuperAdmin && <th className="text-center p-2">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {chain.map((c) => (
            <tr key={c.commission_id} className="border-t border-border">
              <td className="p-2">
                <span className="font-mono font-bold px-2 py-0.5 rounded-full text-white text-[10px]"
                  style={{ background: c.type === 'affiliate' ? NETWORK_COLORS.affiliate : GEN_COLORS[(c.generation || 0) % GEN_COLORS.length] }}>
                  {c.type === 'affiliate' ? 'AFIL' : `G${c.generation}`}
                </span>
              </td>
              <td className="p-2">
                <div className="font-semibold">{c.beneficiary_name}</div>
                <div className="text-txt-secondary text-[11px]">{c.beneficiary_email}</div>
              </td>
              <td className="p-2">
                {c.type === 'affiliate'
                  ? <Badge variant="default">Afiliado Direto</Badge>
                  : c.network_type === 'network_1'
                    ? <Badge variant="brand">Equipe 1</Badge>
                    : c.network_type === 'network_2'
                      ? <Badge variant="info">Equipe 2</Badge>
                      : <span className="text-txt-secondary">—</span>}
              </td>
              <td className="p-2 text-right font-mono font-bold">{c.rate_pct.toFixed(2)}%</td>
              <td className="p-2 text-right font-mono text-txt-secondary">{formatCurrency(subtotal)}</td>
              <td className="p-2 text-right font-bold text-emerald-700">{formatCurrency(c.amount)}</td>
              <td className="p-2 text-center">
                {c.status === 'paid' ? <Badge variant="success">Pago</Badge>
                  : c.status === 'paid_out' ? <Badge variant="info" title="Já saqueado">Saqueado</Badge>
                  : c.status === 'pending' ? <Badge variant="warning">Pendente</Badge>
                  : c.status === 'pending_enrollment' ? <Badge variant="default" title="Beneficiário não está inscrito no Clube. Será liberado quando ele se inscrever.">Aguardando inscrição</Badge>
                  : <Badge variant="default">{c.status}</Badge>}
              </td>
              {isSuperAdmin && (
                <td className="p-2 text-center">
                  {(c.status === 'paid' || c.status === 'paid_out') ? (
                    <button
                      onClick={() => onRevertOne(c)}
                      className="text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded hover:bg-amber-50"
                      title="Reverter para pendente"
                      data-testid={`revert-row-${c.commission_id}`}
                    >
                      ↩ Reverter
                    </button>
                  ) : c.status === 'pending' ? (
                    <button
                      onClick={() => onApproveOne(c)}
                      className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded hover:bg-emerald-50"
                      title="Aprovar (marcar como pago)"
                      data-testid={`approve-row-${c.commission_id}`}
                    >
                      ✓ Aprovar
                    </button>
                  ) : <span className="text-txt-secondary text-[10px]">—</span>}
                </td>
              )}
            </tr>
          ))}
          {chain.length === 0 && (
            <tr><td colSpan={isSuperAdmin ? 8 : 7} className="p-6 text-center text-txt-secondary">Sem cashbacks registradas.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ icon: Icon, color = 'brand', label, value, testId }) {
  const palette = {
    emerald: 'bg-emerald-100 text-emerald-600',
    brand: 'bg-brand-light text-brand-main',
    indigo: 'bg-indigo-100 text-indigo-600',
    amber: 'bg-amber-100 text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl border border-border p-4" data-testid={testId}>
      <div className={`w-9 h-9 ${palette[color]} rounded-lg flex items-center justify-center mb-2`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-heading font-black">{value}</div>
      <div className="text-xs text-txt-secondary">{label}</div>
    </div>
  );
}

function EmptyHint({ msg }) {
  return <div className="h-[280px] flex items-center justify-center text-sm text-txt-secondary">{msg}</div>;
}
