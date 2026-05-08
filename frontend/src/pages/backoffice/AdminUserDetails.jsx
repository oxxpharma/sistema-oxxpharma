import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  ArrowLeft, Loader2, Mail, Phone, Wallet, CircleDollarSign, ShoppingCart,
  CreditCard, Users, Trophy, TrendingUp, Clock, Pencil, SlidersHorizontal,
} from 'lucide-react';
import UserEditModal from '../../components/UserEditModal';
import CashbackAdjustModal from '../../components/admin/CashbackAdjustModal';
import { useAuth } from '../../contexts/AuthContext';

const TABS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'commissions', label: 'Cashbacks' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'network', label: 'Equipe' },
  { id: 'card', label: 'Cartão de Benefícios' },
  { id: 'points', label: 'Pontos' },
];

export default function AdminUserDetails() {
  const { user_id } = useParams();
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [adjustingCashback, setAdjustingCashback] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get(`/api/admin/users/${user_id}/details`);
      setData(d);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user_id]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-main" />
      </div>
    );
  }

  const { user: u, kpis, commissions, orders, network, card, points } = data;

  return (
    <div data-testid="admin-user-details">
      {/* Cabecalho */}
      <div className="mb-5">
        <Link to="/backoffice/usuarios" className="inline-flex items-center gap-1.5 text-xs text-txt-secondary hover:text-brand-main mb-3" data-testid="back-to-users">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a lista
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-light text-brand-main font-black text-xl flex items-center justify-center">
              {u.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl text-txt-primary">{u.name}</h1>
              <div className="flex items-center gap-3 text-xs text-txt-secondary mt-1 flex-wrap">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>
                {u.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>}
                <span className="font-mono">{u.user_id}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {u.role === 'admin' ? <Badge variant="brand">Admin</Badge> : <Badge>Cliente</Badge>}
                <Badge variant={u.status === 'active' ? 'success' : 'error'}>{u.status || 'active'}</Badge>
                {u.network_type && <Badge>{u.network_type}</Badge>}
                {u.referral_program_active && u.referral_code && (
                  <Badge variant="success">Programa ativo · {u.referral_code}</Badge>
                )}
                {u.external_id && <Badge>EXT: {u.external_id}</Badge>}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)} data-testid="open-edit-modal">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-5 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === t.id ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && <OverviewTab kpis={kpis} u={u} isSuperAdmin={isSuperAdmin} onAdjustCashback={() => setAdjustingCashback(true)} />}
      {tab === 'commissions' && <CommissionsTab list={commissions} />}
      {tab === 'orders' && <OrdersTab list={orders} />}
      {tab === 'network' && <NetworkTab network={network} u={u} />}
      {tab === 'card' && <CardTab card={card} />}
      {tab === 'points' && <PointsTab points={points} />}

      {editing && (
        <UserEditModal
          userId={user_id}
          onClose={() => setEditing(false)}
          onSaved={load}
        />
      )}

      <CashbackAdjustModal
        open={adjustingCashback}
        onClose={() => setAdjustingCashback(false)}
        userId={user_id}
        userName={u.name}
        currentBalance={kpis.available || 0}
        onSuccess={load}
      />
    </div>
  );
}

/* ============================================================================ */
/* TAB: Visão Geral                                                             */
/* ============================================================================ */
function KpiCard({ icon: Icon, label, value, hint, color = 'brand' }) {
  const colors = {
    brand: 'text-brand-main bg-brand-light',
    green: 'text-emerald-700 bg-emerald-50',
    blue: 'text-sky-700 bg-sky-50',
    amber: 'text-amber-700 bg-amber-50',
    purple: 'text-purple-700 bg-purple-50',
    slate: 'text-slate-700 bg-slate-100',
  };
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-xs font-semibold text-txt-secondary uppercase tracking-wide">{label}</div>
      </div>
      <div className="text-xl font-heading font-black text-txt-primary">{value}</div>
      {hint && <div className="text-xs text-txt-secondary mt-1">{hint}</div>}
    </div>
  );
}

function OverviewTab({ kpis, u, isSuperAdmin, onAdjustCashback }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Saldos & Cashbacks</div>
          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={onAdjustCashback}
              data-testid="btn-adjust-cashback"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs"
            >
              <SlidersHorizontal className="w-4 h-4" /> Ajustar saldo
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Wallet} label="Disponível p/ saque" value={formatCurrency(kpis.available)} color="green" />
          <KpiCard icon={Clock} label="Em quarentena" value={formatCurrency(kpis.quarantine)} color="amber" hint="Aguardando liberação" />
          <KpiCard icon={CircleDollarSign} label="Cashbacks pendentes" value={formatCurrency(kpis.pending_commissions)} color="blue" hint="Aguardando pagamento" />
          <KpiCard icon={TrendingUp} label="Total já ganho" value={formatCurrency(kpis.total_earned)} color="brand" />
          <KpiCard icon={Wallet} label="Total já sacado" value={formatCurrency(kpis.total_withdrawn)} color="slate" />
          <KpiCard icon={CreditCard} label="Enviado ao cartão" value={formatCurrency(kpis.card_total_sent)} color="purple" />
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">Compras</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={ShoppingCart} label="Pedidos totais" value={kpis.total_orders} color="slate" />
          <KpiCard icon={ShoppingCart} label="Pedidos pagos" value={kpis.paid_orders} color="green" />
          <KpiCard icon={CircleDollarSign} label="Total gasto" value={formatCurrency(kpis.total_spent)} color="brand" />
          <KpiCard icon={Clock} label="Última compra" value={kpis.last_order_at ? formatDateTime(kpis.last_order_at).split(' ')[0] : '-'} color="slate" />
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">Rede & Engajamento</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Users} label="Indicados (afiliado)" value={kpis.direct_referrals} color="brand" hint="Pessoas com este como sponsor_id" />
          <KpiCard icon={Users} label="Downline Equipe direto" value={kpis.direct_downline} color="purple" hint="1ª geração da rede Equipe" />
          <KpiCard icon={Trophy} label="Pontos acumulados" value={kpis.points_total} color="amber" />
          <KpiCard icon={Clock} label="Cadastrado em" value={u.created_at ? formatDateTime(u.created_at).split(' ')[0] : '-'} color="slate" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================================ */
/* TAB: Cashbacks                                                               */
/* ============================================================================ */
function CommissionsTab({ list }) {
  if (!list.length) return <EmptyState text="Sem cashbacks registradas." />;
  const statusBadge = (s) => {
    if (s === 'paid') return <Badge variant="success">Paga</Badge>;
    if (s === 'pending') return <Badge variant="warning">Pendente</Badge>;
    if (s === 'cancelled') return <Badge variant="error">Cancelada</Badge>;
    return <Badge>{s}</Badge>;
  };
  return (
    <div className="bg-white border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
          <tr>
            <th className="text-left p-3">Data</th>
            <th className="text-left p-3">Origem</th>
            <th className="text-left p-3">Pedido</th>
            <th className="text-center p-3">Geração</th>
            <th className="text-right p-3">Valor</th>
            <th className="text-center p-3">Status</th>
            <th className="text-left p-3">Pago em</th>
          </tr>
        </thead>
        <tbody>
          {list.map(c => (
            <tr key={c.commission_id} className="border-t border-border hover:bg-bg-secondary/40">
              <td className="p-3 text-xs text-txt-secondary">{formatDateTime(c.created_at)}</td>
              <td className="p-3 text-xs"><Badge>{c.kind || c.type || '-'}</Badge></td>
              <td className="p-3 font-mono text-xs">{c.order_id ? <Link to={`/backoffice/pedidos`} className="hover:underline">{c.order_id}</Link> : '-'}</td>
              <td className="p-3 text-center text-xs">{c.generation || '-'}</td>
              <td className="p-3 text-right font-bold">{formatCurrency(c.amount)}</td>
              <td className="p-3 text-center">{statusBadge(c.status)}</td>
              <td className="p-3 text-xs text-txt-secondary">{c.paid_at ? formatDateTime(c.paid_at) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================================ */
/* TAB: Pedidos                                                                 */
/* ============================================================================ */
function OrdersTab({ list }) {
  if (!list.length) return <EmptyState text="Sem pedidos registrados." />;
  const payBadge = (s) => {
    if (s === 'paid') return <Badge variant="success">Pago</Badge>;
    if (s === 'pending') return <Badge variant="warning">Aguardando</Badge>;
    if (s === 'cancelled' || s === 'refunded') return <Badge variant="error">{s}</Badge>;
    return <Badge>{s || '-'}</Badge>;
  };
  return (
    <div className="bg-white border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
          <tr>
            <th className="text-left p-3">Data</th>
            <th className="text-left p-3">Pedido</th>
            <th className="text-center p-3">Itens</th>
            <th className="text-right p-3">Total</th>
            <th className="text-center p-3">Pagamento</th>
            <th className="text-center p-3">Status pedido</th>
          </tr>
        </thead>
        <tbody>
          {list.map(o => (
            <tr key={o.order_id} className="border-t border-border hover:bg-bg-secondary/40">
              <td className="p-3 text-xs text-txt-secondary">{formatDateTime(o.created_at)}</td>
              <td className="p-3 font-mono text-xs">{o.order_id}</td>
              <td className="p-3 text-center text-xs">{(o.items || []).length}</td>
              <td className="p-3 text-right font-bold">{formatCurrency(o.total)}</td>
              <td className="p-3 text-center">{payBadge(o.payment_status)}</td>
              <td className="p-3 text-center text-xs"><Badge>{o.status || '-'}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================================ */
/* TAB: Equipe                                                                */
/* ============================================================================ */
function NetworkTab({ network, u }) {
  const { sponsor, network_sponsor, referrals, downline } = network;
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider mb-3">Patrocinador (afiliado)</div>
          {sponsor ? (
            <div>
              <div className="font-semibold">{sponsor.name}</div>
              <div className="text-xs text-txt-secondary">{sponsor.email}</div>
              <div className="text-xs font-mono mt-1">Código: {sponsor.referral_code || '-'}</div>
              <Link to={`/backoffice/usuarios/${sponsor.user_id}`} className="text-xs text-brand-main hover:underline mt-2 inline-block" data-testid="sponsor-link">Ver detalhes →</Link>
            </div>
          ) : <div className="text-xs text-txt-secondary">Sem patrocinador.</div>}
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider mb-3">Líder na rede Equipe</div>
          {network_sponsor ? (
            <div>
              <div className="font-semibold">{network_sponsor.name}</div>
              <div className="text-xs text-txt-secondary">{network_sponsor.email}</div>
              {network_sponsor.external_id && <div className="text-xs font-mono mt-1">EXT: {network_sponsor.external_id}</div>}
              <Link to={`/backoffice/usuarios/${network_sponsor.user_id}`} className="text-xs text-brand-main hover:underline mt-2 inline-block" data-testid="network-sponsor-link">Ver detalhes →</Link>
            </div>
          ) : (
            <div className="text-xs text-txt-secondary">
              {u.leader_external_id
                ? <>Aguardando vínculo. <span className="font-mono">leader_external_id</span> = {u.leader_external_id}</>
                : 'Sem líder definido.'}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">Indicados diretos (afiliado) — {referrals.length}</div>
        <UserMiniList list={referrals} emptyText="Nenhum indicado direto." showProgram />
      </div>

      {/* Downline ate 6 geracoes - rede Equipe */}
      <div>
        <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
          Downline rede Equipe — até 6 gerações ({(network.downline_by_generation || []).reduce((s, g) => s + (g.members_count || 0), 0)} membros total)
        </div>
        <DownlineByGeneration generations={network.downline_by_generation || []} />
      </div>
    </div>
  );
}

function DownlineByGeneration({ generations }) {
  const [expanded, setExpanded] = React.useState({});
  if (!generations.length) {
    return <div className="text-xs text-txt-secondary bg-white border border-border rounded-lg p-4">Nenhum membro na rede.</div>;
  }
  return (
    <div className="space-y-2">
      {generations.map((gen) => {
        const isExp = !!expanded[gen.generation];
        const isEmpty = gen.members_count === 0;
        return (
          <div key={gen.generation} className="bg-white border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => !isEmpty && setExpanded({ ...expanded, [gen.generation]: !isExp })}
              disabled={isEmpty}
              className={`w-full flex items-center gap-3 p-3 text-left ${isEmpty ? 'opacity-50 cursor-default' : 'hover:bg-bg-secondary/50'}`}
              data-testid={`gen-${gen.generation}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-heading font-black text-sm shrink-0 ${gen.generation === 1 ? 'bg-brand-main text-white' : 'bg-brand-light text-brand-main'}`}>
                {gen.generation}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{gen.generation}ª geração</div>
                <div className="text-xs text-txt-secondary">{gen.members_count} {gen.members_count === 1 ? 'membro' : 'membros'}</div>
              </div>
              {!isEmpty && <div className="text-xs text-brand-main">{isExp ? 'ocultar ▲' : 'ver membros ▼'}</div>}
            </button>
            {isExp && gen.members_count > 0 && (
              <div className="border-t border-border">
                <UserMiniList list={gen.members} emptyText="" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UserMiniList({ list, emptyText, showProgram = false }) {
  if (!list.length) return <div className="text-xs text-txt-secondary bg-white border border-border rounded-lg p-4">{emptyText}</div>;
  return (
    <div className="bg-white border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
          <tr>
            <th className="text-left p-3">Nome</th>
            <th className="text-left p-3">E-mail</th>
            <th className="text-left p-3">Cadastrado em</th>
            {showProgram && <th className="text-center p-3">Programa</th>}
            <th className="text-right p-3"></th>
          </tr>
        </thead>
        <tbody>
          {list.map(x => (
            <tr key={x.user_id} className="border-t border-border hover:bg-bg-secondary/40">
              <td className="p-3 font-semibold">{x.name}</td>
              <td className="p-3 text-xs">{x.email}</td>
              <td className="p-3 text-xs text-txt-secondary">{x.created_at ? formatDateTime(x.created_at) : '-'}</td>
              {showProgram && <td className="p-3 text-center">{x.referral_program_active ? <Badge variant="success">Ativo</Badge> : <Badge>—</Badge>}</td>}
              <td className="p-3 text-right">
                <Link to={`/backoffice/usuarios/${x.user_id}`} className="text-xs text-brand-main hover:underline">Ver →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================================ */
/* TAB: Cartão de Benefícios                                                    */
/* ============================================================================ */
function CardTab({ card }) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-brand-main to-brand-hover text-white rounded-xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Total enviado ao cartão</div>
        <div className="text-3xl font-heading font-black mt-1">{formatCurrency(card.total_sent)}</div>
      </div>
      {card.lines.length === 0 ? (
        <EmptyState text="Nenhum envio para o cartão ainda." />
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Lote</th>
                <th className="text-left p-3">Gerado em</th>
                <th className="text-center p-3">Status do lote</th>
                <th className="text-center p-3">Cashbacks</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Enviado em</th>
              </tr>
            </thead>
            <tbody>
              {card.lines.map((l, i) => (
                <tr key={i} className="border-t border-border hover:bg-bg-secondary/40">
                  <td className="p-3 font-mono text-xs">{l.batch_id}</td>
                  <td className="p-3 text-xs text-txt-secondary">{l.batch_created_at ? formatDateTime(l.batch_created_at) : '-'}</td>
                  <td className="p-3 text-center"><Badge>{l.batch_status || '-'}</Badge></td>
                  <td className="p-3 text-center text-xs">{l.commissions_count || 0}</td>
                  <td className="p-3 text-right font-bold">{formatCurrency(l.amount)}</td>
                  <td className="p-3 text-xs text-txt-secondary">{l.sent_at ? formatDateTime(l.sent_at) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================================ */
/* TAB: Pontos                                                                  */
/* ============================================================================ */
function PointsTab({ points }) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-4">
        <Trophy className="w-10 h-10 text-amber-600" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Total de pontos</div>
          <div className="text-3xl font-heading font-black text-amber-900">{points.total.toLocaleString('pt-BR')}</div>
        </div>
      </div>
      {points.logs.length === 0 ? (
        <EmptyState text="Nenhum ponto registrado." />
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Pedido</th>
                <th className="text-left p-3">Produto</th>
                <th className="text-center p-3">Qtd.</th>
                <th className="text-right p-3">Pts/un.</th>
                <th className="text-right p-3">Total</th>
                <th className="text-center p-3">Aplicado</th>
              </tr>
            </thead>
            <tbody>
              {points.logs.map((l, i) => (
                <tr key={i} className="border-t border-border hover:bg-bg-secondary/40">
                  <td className="p-3 text-xs text-txt-secondary">{l.registered_at ? formatDateTime(l.registered_at) : '-'}</td>
                  <td className="p-3 font-mono text-xs">{l.order_id || '-'}</td>
                  <td className="p-3 text-xs">{l.product_name || l.product_id || '-'}</td>
                  <td className="p-3 text-center text-xs">{l.quantity || '-'}</td>
                  <td className="p-3 text-right text-xs">{l.points_unit ?? '-'}</td>
                  <td className="p-3 text-right font-bold">{l.points_total ?? '-'}</td>
                  <td className="p-3 text-center">{l.applied_externally ? <Badge variant="success">Sim</Badge> : <Badge>—</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================================ */
function EmptyState({ text }) {
  return <div className="bg-white border border-border rounded-xl p-10 text-center text-sm text-txt-secondary">{text}</div>;
}
