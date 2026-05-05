import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  Calculator, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Filter,
  Search, ChevronDown, ChevronRight, Users, Receipt, History,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRecalcCommissions() {
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    customer_email: '',
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const buildBody = () => {
    const b = {};
    if (filters.date_from) b.date_from = filters.date_from;
    if (filters.date_to) b.date_to = filters.date_to;
    if (filters.customer_email.trim()) b.customer_email = filters.customer_email.trim().toLowerCase();
    return b;
  };

  const onSimulate = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const r = await api.post('/api/admin/recalc-commissions/preview', buildBody());
      setPreview(r);
      if (r.orders_eligible === 0) {
        toast.info('Nenhum pedido elegível encontrado com esses filtros.');
      } else if (r.total_commissions === 0) {
        toast.warning(`${r.orders_eligible} pedidos elegíveis, mas nenhuma comissão a ser criada (sem cadeia ativa).`);
      } else {
        toast.success(`Simulação concluída: ${r.total_commissions} comissões totalizando ${formatCurrency(r.total_amount)}.`);
      }
    } catch (e) {
      toast.error('Falha ao simular: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const onApply = async () => {
    setApplying(true);
    try {
      const r = await api.post('/api/admin/recalc-commissions/apply', buildBody());
      toast.success(`Recalculo concluído: ${r.commissions_created} comissões criadas (${formatCurrency(r.total_amount)}). Batch: ${r.batch_id?.slice(0, 16)}…`);
      setConfirmOpen(false);
      setPreview(null);
      // recarrega historico
      loadHistory();
    } catch (e) {
      toast.error('Falha ao aplicar: ' + (e.message || e));
    } finally {
      setApplying(false);
    }
  };

  const loadHistory = async () => {
    try {
      const r = await api.get('/api/admin/recalc-commissions/history?limit=50');
      setHistory(r.items || []);
    } catch (e) { /* silent */ }
  };

  const onToggleHistory = async () => {
    if (!showHistory) await loadHistory();
    setShowHistory(!showHistory);
  };

  const canApply = preview && preview.total_commissions > 0;

  return (
    <div data-testid="admin-recalc-commissions">
      <div className="mb-5">
        <h1 className="font-heading font-black text-2xl text-txt-primary flex items-center gap-2">
          <Calculator className="w-6 h-6 text-brand-main" /> Recalcular comissões retroativamente
        </h1>
        <p className="text-sm text-txt-secondary mt-1 max-w-3xl">
          Útil para pedidos que foram pagos <strong>antes</strong> da sincronização Maxx ter informado o líder.
          Esta ferramenta encontra pedidos pagos <strong>sem nenhuma comissão</strong> registrada, simula o cálculo
          com a cadeia atual (afiliado + Equipe até a 6ª geração) e, depois de você confirmar, grava as comissões
          marcadas como retroativas.
        </p>
      </div>

      {/* Banner de regras */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3" data-testid="recalc-rules-banner">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <div className="font-bold mb-1">Como funciona</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Considera apenas pedidos com <strong>payment_status = paid</strong> e <strong>sem comissão</strong> existente.</li>
            <li>Aplica a regra atual: afiliado (sponsor_id direto) + Equipe até 6 gerações via cadeia <code className="font-mono">sponsor_id → network_sponsor_id</code>.</li>
            <li>Comissões geradas ficam com flag <code className="font-mono">retroactive=true</code> e <code className="font-mono">recalc_batch_id</code> para auditoria.</li>
            <li>Status inicial das comissões: <strong>pending</strong> (mesmo comportamento dos pedidos novos).</li>
          </ul>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-border p-5 mb-4" data-testid="recalc-filters">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-brand-main" />
          <h3 className="font-bold text-sm">Filtros</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Data inicial">
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              data-testid="filter-date-from"
            />
          </Field>
          <Field label="Data final">
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters({ ...filters, date_to: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              data-testid="filter-date-to"
            />
          </Field>
          <Field label="E-mail do cliente (opcional)">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-secondary" />
              <input
                type="email"
                placeholder="cliente@email.com"
                value={filters.customer_email}
                onChange={e => setFilters({ ...filters, customer_email: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm"
                data-testid="filter-customer-email"
              />
            </div>
          </Field>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={onSimulate} disabled={loading} data-testid="btn-simulate">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Simular recálculo
          </Button>
          {preview && (
            <Button variant="outline" onClick={() => { setPreview(null); setExpanded({}); }} data-testid="btn-clear">
              Limpar resultado
            </Button>
          )}
          <Button variant="outline" onClick={onToggleHistory} className="ml-auto" data-testid="btn-toggle-history">
            <History className="w-4 h-4" /> {showHistory ? 'Ocultar histórico' : 'Ver histórico'}
          </Button>
        </div>
      </div>

      {/* Resultado da simulação */}
      {preview && (
        <div className="space-y-4" data-testid="recalc-preview">
          {/* Sumário */}
          <div className="grid sm:grid-cols-4 gap-3">
            <SumCard label="Pedidos elegíveis" value={preview.orders_eligible} icon={Receipt} testId="sum-orders" />
            <SumCard label="Pedidos que gerarão comissão" value={preview.orders_with_commissions} color="text-emerald-700 bg-emerald-50" testId="sum-orders-with" />
            <SumCard label="Comissões a criar" value={preview.total_commissions} color="text-brand-main bg-brand-light" testId="sum-comms" />
            <SumCard label="Valor total" value={formatCurrency(preview.total_amount)} color="text-brand-main bg-brand-light" big testId="sum-amount" />
          </div>

          {/* Iter 40: Split inscritos vs aguardando inscricao */}
          {(preview.commissions_pending_enrollment > 0 || preview.commissions_pending > 0) && (
            <div className="grid sm:grid-cols-2 gap-3" data-testid="enrollment-split">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="text-xs uppercase font-bold text-emerald-700 mb-1">Liberadas (inscritos)</div>
                <div className="text-2xl font-heading font-black text-emerald-700">{preview.commissions_pending}</div>
                <div className="text-xs text-emerald-700/80">{formatCurrency(preview.commissions_pending_amount)} — pagáveis imediatamente</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="text-xs uppercase font-bold text-amber-700 mb-1">Aguardando inscrição no programa</div>
                <div className="text-2xl font-heading font-black text-amber-700">{preview.commissions_pending_enrollment}</div>
                <div className="text-xs text-amber-700/80">{formatCurrency(preview.commissions_pending_enrollment_amount)} — liberadas quando o beneficiário se inscrever</div>
              </div>
            </div>
          )}

          {/* Beneficiários */}
          {preview.beneficiaries?.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-5" data-testid="beneficiaries-card">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-brand-main" />
                <h3 className="font-bold">Beneficiários ({preview.beneficiaries.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-txt-secondary bg-bg-secondary">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">E-mail</th>
                      <th className="text-left p-2">Rede</th>
                      <th className="text-right p-2">Comissões</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.beneficiaries.map((b, i) => (
                      <tr key={b.user_id} className="border-t border-border">
                        <td className="p-2 text-xs text-txt-secondary">{i + 1}</td>
                        <td className="p-2 font-semibold">
                          <Link to={`/backoffice/usuarios/${b.user_id}`} className="hover:text-brand-main">{b.name || '(sem nome)'}</Link>
                        </td>
                        <td className="p-2 text-xs">{b.email}</td>
                        <td className="p-2 text-xs">
                          {b.network_type === 'network_1' && <Badge variant="brand">Equipe 1</Badge>}
                          {b.network_type === 'network_2' && <Badge variant="success">Equipe 2</Badge>}
                          {(!b.network_type || b.network_type === 'customer') && <Badge>Cliente</Badge>}
                        </td>
                        <td className="p-2 text-right">{b.count}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{formatCurrency(b.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lista de pedidos afetados */}
          <div className="bg-white rounded-2xl border border-border p-5" data-testid="affected-orders-card">
            <h3 className="font-bold mb-3">Pedidos afetados ({preview.affected_orders.length})</h3>
            <div className="space-y-1">
              {preview.affected_orders.map(o => {
                const isExp = !!expanded[o.order_id];
                const willGenerate = o.commissions_count > 0;
                return (
                  <div key={o.order_id} className={`rounded-lg border ${willGenerate ? 'border-emerald-200 bg-emerald-50/40' : 'border-border bg-bg-secondary/40'}`}>
                    <button
                      type="button"
                      onClick={() => willGenerate && setExpanded(s => ({ ...s, [o.order_id]: !isExp }))}
                      disabled={!willGenerate}
                      className={`w-full flex items-center gap-3 p-3 text-left text-sm ${willGenerate ? 'hover:bg-emerald-50' : 'cursor-default'}`}
                      data-testid={`order-row-${o.order_id}`}
                    >
                      {willGenerate
                        ? (isExp ? <ChevronDown className="w-4 h-4 text-brand-main shrink-0" /> : <ChevronRight className="w-4 h-4 text-brand-main shrink-0" />)
                        : <span className="w-4 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">#{o.order_id.slice(-8).toUpperCase()}</span>
                          <span className="font-semibold truncate">{o.customer_name || o.customer_email}</span>
                        </div>
                        <div className="text-[11px] text-txt-secondary">
                          {o.created_at ? formatDateTime(o.created_at) : ''} · {o.customer_email}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-txt-secondary">total: {formatCurrency(o.total)}</div>
                        {willGenerate ? (
                          <div className="font-bold text-emerald-700 text-sm">
                            +{o.commissions_count} comissões · {formatCurrency(o.commissions_total)}
                          </div>
                        ) : (
                          <Badge variant="default">sem cadeia ativa</Badge>
                        )}
                      </div>
                    </button>
                    {isExp && willGenerate && (
                      <div className="border-t border-emerald-200 px-3 py-2 bg-white text-xs">
                        <div className="font-bold mb-1.5">Comissões a criar:</div>
                        <ul className="space-y-1">
                          {o.commissions_breakdown.map((c, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 py-1">
                              <span className="flex items-center gap-2">
                                <Badge>{c.type === 'affiliate' ? 'Afiliado' : `Equipe gen ${c.generation}`}</Badge>
                                <span className="font-mono text-[11px] text-txt-secondary">{c.user_id}</span>
                              </span>
                              <span className="font-bold">{formatCurrency(c.amount)} <span className="font-normal text-txt-secondary">({(c.rate * 100).toFixed(2)}%)</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
              {preview.affected_orders.length === 0 && (
                <div className="text-sm text-txt-secondary p-4 text-center">Nenhum pedido encontrado.</div>
              )}
            </div>
          </div>

          {/* Botão de aplicar */}
          {canApply && (
            <div className="bg-white rounded-2xl border border-border p-5 flex items-center justify-between flex-wrap gap-3" data-testid="apply-section">
              <div>
                <div className="font-bold">Pronto para gravar?</div>
                <div className="text-xs text-txt-secondary">
                  {preview.total_commissions} comissões · {formatCurrency(preview.total_amount)} no total. Esta ação é <strong>irreversível</strong>.
                </div>
              </div>
              <Button onClick={() => setConfirmOpen(true)} data-testid="btn-open-confirm">
                <CheckCircle2 className="w-4 h-4" /> Confirmar e gravar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      {showHistory && (
        <div className="bg-white rounded-2xl border border-border p-5 mt-4" data-testid="history-card">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-5 h-5 text-brand-main" />
            <h3 className="font-bold">Histórico de recálculos</h3>
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-txt-secondary py-6 text-center">Nenhum recálculo executado ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-txt-secondary bg-bg-secondary">
                  <tr>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Por</th>
                    <th className="text-left p-2">Filtros</th>
                    <th className="text-right p-2">Pedidos</th>
                    <th className="text-right p-2">Comissões</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-left p-2">Batch ID</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => {
                    const f = h.filters || {};
                    const filterStr = [
                      f.date_from && `de ${f.date_from}`,
                      f.date_to && `até ${f.date_to}`,
                      f.customer_email && `cliente ${f.customer_email}`,
                    ].filter(Boolean).join(' · ') || 'todos';
                    return (
                      <tr key={h.batch_id} className="border-t border-border">
                        <td className="p-2 text-xs text-txt-secondary whitespace-nowrap">{formatDateTime(h.performed_at)}</td>
                        <td className="p-2 text-xs">{h.performed_by_email}</td>
                        <td className="p-2 text-xs">{filterStr}</td>
                        <td className="p-2 text-right">{h.orders_processed}</td>
                        <td className="p-2 text-right">{h.commissions_created}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{formatCurrency(h.total_amount || 0)}</td>
                        <td className="p-2 font-mono text-[11px] text-txt-secondary">{h.batch_id}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="confirm-recalc-modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-5 border-b border-border">
              <h3 className="font-heading font-black text-xl flex items-center gap-2">
                <Calculator className="w-5 h-5 text-brand-main" /> Confirmar recálculo
              </h3>
              <p className="text-xs text-txt-secondary mt-1">Esta ação é irreversível.</p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="font-bold mb-1">Resumo:</div>
                <ul className="text-xs space-y-0.5">
                  <li>Pedidos a processar: <strong>{preview.orders_with_commissions}</strong></li>
                  <li>Comissões a criar: <strong>{preview.total_commissions}</strong></li>
                  <li>Valor total: <strong>{formatCurrency(preview.total_amount)}</strong></li>
                  <li>Beneficiários únicos: <strong>{preview.beneficiaries.length}</strong></li>
                </ul>
              </div>
              <p className="text-xs text-txt-secondary">
                As comissões serão criadas com status <strong>pending</strong> e marcadas como retroativas.
                Você pode acompanhá-las pela tela de comissões e relatório.
              </p>
            </div>
            <div className="p-5 border-t border-border flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={applying} data-testid="btn-cancel-confirm">
                Cancelar
              </Button>
              <Button onClick={onApply} disabled={applying} data-testid="btn-confirm-apply">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar e gravar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-txt-secondary mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function SumCard({ label, value, color, big = false, testId }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4" data-testid={testId}>
      <div className={`text-xs font-bold uppercase tracking-wider mb-1 inline-block px-2 py-0.5 rounded ${color || 'text-txt-secondary'}`}>
        {label}
      </div>
      <div className={`font-heading font-black ${big ? 'text-2xl' : 'text-xl'} text-txt-primary`}>{value}</div>
    </div>
  );
}
