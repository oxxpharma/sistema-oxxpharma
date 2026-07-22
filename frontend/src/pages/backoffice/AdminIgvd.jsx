import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader2, Save, Webhook, RefreshCw, Ticket, Copy, Plus, Trash2, Package, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, formatCurrency } from '../../lib/utils';

const STATUS_VARIANTS = { pending: 'warning', applied: 'success', failed: 'danger', cancelled: 'secondary' };

export default function AdminIgvd() {
  const [cfg, setCfg] = useState({ igvd_voucher_enabled: false, igvd_voucher_secret: '', igvd_kit_items: [] });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, applied: 0 });
  const [reprocessOrderId, setReprocessOrderId] = useState('');
  const [reprocessing, setReprocessing] = useState(false);
  const [lastReprocess, setLastReprocess] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, all, pend, appl, prods] = await Promise.all([
        api.get('/api/admin/settings').catch(() => ({})),
        api.get('/api/admin/igvd/vouchers?limit=50'),
        api.get('/api/admin/igvd/vouchers?status=pending&limit=1'),
        api.get('/api/admin/igvd/vouchers?status=applied&limit=1'),
        api.get('/api/admin/products?limit=500').catch(() => ({ products: [] })),
      ]);
      setCfg({
        igvd_voucher_enabled: !!c.igvd_voucher_enabled,
        igvd_voucher_secret: c.igvd_voucher_secret || '',
        igvd_kit_items: Array.isArray(c.igvd_kit_items) ? c.igvd_kit_items : [],
      });
      setItems(all.items || []);
      setStats({ total: all.total || 0, pending: pend.total || 0, applied: appl.total || 0 });
      setProducts(prods.products || prods.items || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/settings', {
        igvd_voucher_enabled: cfg.igvd_voucher_enabled,
        igvd_voucher_secret: cfg.igvd_voucher_secret,
        igvd_kit_items: cfg.igvd_kit_items,
      });
      toast.success('Configurações salvas');
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const retryPending = async () => {
    setRetrying(true);
    try {
      const r = await api.post('/api/admin/igvd/vouchers/retry-pending');
      toast.success(`${r.applied}/${r.scanned} aplicados · ${r.still_pending} continuam pendentes`);
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setRetrying(false); }
  };

  const reprocessOrder = async () => {
    const id = (reprocessOrderId || '').trim();
    if (!id) { toast.error('Informe o ID do pedido (ex: 10E6A477 ou ord_...)'); return; }
    if (!window.confirm(`Reprocessar hooks do pedido ${id}? Isso vai gerar comissões/cashback, pontos e reenviar a fatura por e-mail (idempotente).`)) return;
    setReprocessing(true);
    setLastReprocess(null);
    try {
      const r = await api.post('/api/admin/igvd/reprocess-order', { order_id: id });
      setLastReprocess(r);
      toast.success(`Pedido #${r.short_id} reprocessado — ${r.commissions_created} cashback(s), ${r.points_created} log(s) de pontos.`);
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setReprocessing(false); }
  };

  const filtered = filter ? items.filter(v => v.status === filter) : items;

  const productMap = React.useMemo(() => Object.fromEntries((products || []).map(p => [p.product_id, p])), [products]);

  const kitAddItem = () => setCfg((c) => ({ ...c, igvd_kit_items: [...(c.igvd_kit_items || []), { product_id: '', quantity: 1 }] }));
  const kitUpdate = (idx, patch) => setCfg((c) => ({ ...c, igvd_kit_items: (c.igvd_kit_items || []).map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const kitRemove = (idx) => setCfg((c) => ({ ...c, igvd_kit_items: (c.igvd_kit_items || []).filter((_, i) => i !== idx) }));
  const kitTotal = (cfg.igvd_kit_items || []).reduce((acc, it) => {
    const p = productMap[it.product_id];
    return acc + (p ? Number(p.price || 0) * Number(it.quantity || 0) : 0);
  }, 0);

  const webhookUrl = `${window.location.origin}/api/integrations/igvd/voucher`;
  const sandboxUrl = `${window.location.origin}/api/integrations/igvd/voucher/sandbox`;

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-igvd">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-black text-3xl">IGVD · Vouchers de Adesão</h1>
          <p className="text-sm text-txt-secondary mt-1">Recebe vouchers automaticamente quando uma adesão é paga na IGVD.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={retryPending} loading={retrying} data-testid="retry-pending-btn">
            <RefreshCw className="w-4 h-4" /> Reprocessar pendentes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-txt-secondary">Total recebidos</div>
          <div className="text-2xl font-black">{stats.total}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs text-emerald-700">Aplicados</div>
          <div className="text-2xl font-black text-emerald-700">{stats.applied}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs text-amber-700">Pendentes (aguardando cadastro)</div>
          <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl p-5 mb-6" data-testid="igvd-reprocess-card">
        <div className="flex items-center gap-2 mb-2">
          <PlayCircle className="w-5 h-5 text-brand-main" />
          <h2 className="font-heading font-bold">Reprocessar hooks de pedido IGVD</h2>
        </div>
        <p className="text-xs text-txt-secondary mb-3">
          Dispara novamente as ações pós-pagamento (cashback para o sponsor, pontos Maxx e envio da fatura por e-mail)
          para um pedido IGVD antigo. Idempotente: cashbacks já criados não duplicam. Aceita o ID curto (ex.: <code className="font-mono">10E6A477</code>) ou completo (<code className="font-mono">ord_...</code>).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={reprocessOrderId}
            onChange={(e) => setReprocessOrderId(e.target.value)}
            placeholder="ID do pedido (ex: #10E6A477)"
            className="flex-1 min-w-[220px] px-3 py-2 border border-border rounded-lg font-mono text-sm"
            data-testid="reprocess-order-input"
            onKeyDown={(e) => { if (e.key === 'Enter') reprocessOrder(); }}
          />
          <Button onClick={reprocessOrder} loading={reprocessing} data-testid="reprocess-order-btn">
            <PlayCircle className="w-4 h-4" /> Reprocessar
          </Button>
        </div>
        {lastReprocess && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs" data-testid="reprocess-result">
            <div className="font-bold text-emerald-800 mb-1">✓ Pedido #{lastReprocess.short_id} reprocessado</div>
            <div className="text-emerald-700 grid grid-cols-2 md:grid-cols-4 gap-2">
              <span>Cashbacks criadas agora: <b>{lastReprocess.commissions_created}</b></span>
              <span>Total de cashbacks no pedido: <b>{lastReprocess.commissions_total}</b></span>
              <span>Logs de pontos criados: <b>{lastReprocess.points_created}</b></span>
              <span>Voucher IGVD: <code className="font-mono">{lastReprocess.voucher_code}</code></span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-border rounded-xl p-5 mb-6" data-testid="igvd-config-card">
        <h2 className="font-heading font-bold mb-3 flex items-center gap-2"><Webhook className="w-5 h-5 text-brand-main" /> Configuração do Webhook</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-txt-secondary block mb-1">URL de PRODUÇÃO (recebe vouchers reais)</label>
            <div className="flex gap-2">
              <input readOnly value={webhookUrl} className="flex-1 px-3 py-2 border border-border rounded-lg font-mono text-xs bg-bg-secondary" data-testid="webhook-url" />
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copiado'); }}><Copy className="w-3.5 h-3.5" /></Button>
            </div>
            <p className="text-[11px] text-txt-secondary mt-1">Cole no painel da IGVD em <span className="font-mono">/admin/system → OxxPharma → URL do endpoint</span>.</p>

            <label className="text-xs font-bold text-amber-700 block mb-1 mt-3">URL de SANDBOX (somente teste de conexão · não grava nada)</label>
            <div className="flex gap-2">
              <input readOnly value={sandboxUrl} className="flex-1 px-3 py-2 border border-amber-300 rounded-lg font-mono text-xs bg-amber-50" data-testid="sandbox-url" />
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(sandboxUrl); toast.success('Copiado'); }}><Copy className="w-3.5 h-3.5" /></Button>
            </div>
            <p className="text-[11px] text-txt-secondary mt-1">Use no botão <span className="font-mono">Testar conexão</span> da IGVD. Mesma <code>x-Api-Key</code>; valida o payload e devolve <code>status: simulated</code>.</p>
          </div>
          <div>
            <label className="text-xs font-bold text-txt-secondary block mb-1">x-Api-Key (token compartilhado)</label>
            <input value={cfg.igvd_voucher_secret} onChange={(e) => setCfg({ ...cfg, igvd_voucher_secret: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg font-mono text-sm" placeholder="ex: oxx_igvd_xxxxxxxxxx" data-testid="igvd-secret-input" />
            <p className="text-[11px] text-txt-secondary mt-1">Cole o mesmo valor no painel da IGVD. Requests sem este header são rejeitadas com 401.</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cfg.igvd_voucher_enabled} onChange={(e) => setCfg({ ...cfg, igvd_voucher_enabled: e.target.checked })} className="w-5 h-5 accent-brand-main" data-testid="igvd-enabled-toggle" />
            <span className="text-sm font-semibold">{cfg.igvd_voucher_enabled ? 'Webhook ATIVADO' : 'Webhook desativado'}</span>
          </label>
          <Button onClick={save} loading={saving} data-testid="save-igvd-btn"><Save className="w-4 h-4" /> Salvar</Button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl p-5 mb-6" data-testid="igvd-kit-card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-heading font-bold flex items-center gap-2"><Package className="w-5 h-5 text-brand-main" /> Kit de Adesão IGVD</h2>
            <p className="text-xs text-txt-secondary mt-0.5">Produtos que serão adicionados ao pedido gerado automaticamente. O pedido é criado 1 vez por conta (idempotente).</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-txt-secondary">Valor do kit (soma dos preços)</div>
            <div className="font-black text-lg text-brand-main">{formatCurrency(kitTotal)}</div>
          </div>
        </div>
        <div className="space-y-2">
          {(cfg.igvd_kit_items || []).length === 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Nenhum produto configurado. Adicione ao menos 1 produto para o webhook começar a gerar pedidos.
            </div>
          )}
          {(cfg.igvd_kit_items || []).map((it, idx) => {
            const p = productMap[it.product_id];
            const line = p ? Number(p.price || 0) * Number(it.quantity || 0) : 0;
            return (
              <div key={idx} className="flex items-center gap-2" data-testid={`kit-row-${idx}`}>
                <select
                  value={it.product_id}
                  onChange={(e) => kitUpdate(idx, { product_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                  data-testid={`kit-product-${idx}`}
                >
                  <option value="">— selecione o produto —</option>
                  {products.map(pr => (
                    <option key={pr.product_id} value={pr.product_id}>{pr.name} · {formatCurrency(pr.price)} {pr.sku ? `· ${pr.sku}` : ''}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={it.quantity}
                  onChange={(e) => kitUpdate(idx, { quantity: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                  className="w-20 px-2 py-2 border border-border rounded-lg text-sm text-center font-bold"
                  data-testid={`kit-qty-${idx}`}
                />
                <div className="w-24 text-right text-sm font-bold text-txt-primary">{formatCurrency(line)}</div>
                <button onClick={() => kitRemove(idx)} className="p-2 hover:bg-rose-50 rounded" title="Remover" data-testid={`kit-remove-${idx}`}>
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={kitAddItem} data-testid="kit-add-btn">
            <Plus className="w-4 h-4" /> Adicionar produto
          </Button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-heading font-bold flex items-center gap-2"><Ticket className="w-5 h-5 text-brand-main" /> Vouchers recebidos</h2>
          <div className="flex gap-2">
            {['', 'pending', 'applied'].map(s => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-xs font-bold rounded-full border ${filter === s ? 'bg-brand-main text-white border-brand-main' : 'border-border bg-white hover:bg-bg-secondary'}`} data-testid={`igvd-filter-${s || 'all'}`}>
                {s === '' ? 'Todos' : s === 'pending' ? 'Pendentes' : 'Aplicados'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary">
              <tr className="text-left">
                <th className="p-3">Voucher</th>
                <th className="p-3">Licenciado</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3">Recebido</th>
                <th className="p-3">Status</th>
                <th className="p-3">Pedido gerado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-txt-secondary">Nenhum voucher recebido ainda.</td></tr>
              ) : filtered.map(v => (
                <tr key={v.voucher_code} className="border-t border-border" data-testid={`igvd-row-${v.voucher_code}`}>
                  <td className="p-3 font-mono text-xs">{v.voucher_code}</td>
                  <td className="p-3">
                    <div className="font-semibold">{v.licenciado_name || '-'}</div>
                    <div className="text-xs text-txt-secondary">{v.licenciado_email}</div>
                    {v.licenciado_cpf_digits && <div className="text-[10px] font-mono text-txt-secondary">CPF: {v.licenciado_cpf_digits}</div>}
                  </td>
                  <td className="p-3 text-right font-bold">{formatCurrency(v.amount_brl)}</td>
                  <td className="p-3 text-xs">{formatDateTime(v.received_at)}</td>
                  <td className="p-3"><Badge variant={STATUS_VARIANTS[v.status] || 'secondary'}>{v.status}</Badge></td>
                  <td className="p-3 text-xs">
                    {v.generated_order_id ? (
                      <a href={`/backoffice/pedidos`} className="font-mono text-brand-main hover:underline">#{String(v.generated_order_id).slice(-8).toUpperCase()}</a>
                    ) : v.note ? (
                      <span className="text-[11px] text-amber-700">{v.note}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
