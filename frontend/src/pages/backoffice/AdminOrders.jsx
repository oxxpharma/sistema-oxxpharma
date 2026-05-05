import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Search, Eye, Loader2, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../../components/admin/Pagination';

const STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Aguardando pagamento' },
  { value: 'paid', label: 'Pago' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];
const STATUS_LABELS = {
  pending: { label: 'Aguardando', variant: 'warning' },
  paid: { label: 'Pago', variant: 'success' },
  shipped: { label: 'Enviado', variant: 'info' },
  delivered: { label: 'Entregue', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'error' },
};

const PAGE_LIMIT = 20;

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (search) q.set('search', search);
      q.set('page', String(targetPage));
      q.set('limit', String(PAGE_LIMIT));
      const d = await api.get(`/api/admin/orders?${q}`);
      setOrders(d.orders || []);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
      setPage(d.page || targetPage);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [status]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const updated = await api.put(`/api/admin/orders/${orderId}/status`, { status: newStatus });
      toast.success('Status atualizado');
      setOrders(prev => prev.map(o => o.order_id === orderId ? updated : o));
      if (selected?.order_id === orderId) setSelected(updated);
    } catch (err) { toast.error(err.message); }
  };

  const deleteOrder = async (o) => {
    const confirmMsg =
      `Deletar PERMANENTEMENTE o pedido ${o.order_id}?\n\n` +
      `Isso vai APAGAR:\n` +
      `• O registro do pedido\n` +
      `• Comissões geradas por este pedido\n` +
      `• Pontos atribuídos por este pedido\n` +
      `• Logs de webhook (pagamento + Equipe)\n\n` +
      `E REVERTERÁ:\n` +
      `• Estoque dos produtos\n` +
      `• Contador de uso do cupom (se houver)\n\n` +
      `Esta ação NÃO pode ser desfeita.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const r = await api.delete(`/api/admin/orders/${o.order_id}`);
      const s = r?.summary || {};
      toast.success(`Pedido excluído (${s.commissions_deleted || 0} comissões, ${s.points_deleted || 0} pontos${s.stock_restored ? ', estoque revertido' : ''})`);
      if (selected?.order_id === o.order_id) setSelected(null);
      setOrders(prev => prev.filter(x => x.order_id !== o.order_id));
    } catch (err) { toast.error(err.message || 'Erro ao deletar'); }
  };

  return (
    <div data-testid="admin-orders">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-6">Pedidos</h1>

      <div className="bg-white rounded-xl border border-border p-4 mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(1)}
            className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-lg text-sm"
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" data-testid="status-filter">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Button variant="outline" onClick={() => load(1)}>Buscar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Pedido</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const s = STATUS_LABELS[o.order_status] || STATUS_LABELS.pending;
                  return (
                    <tr key={o.order_id} className="border-t border-border hover:bg-bg-secondary/50" data-testid={`order-row-${o.order_id}`}>
                      <td className="p-3 font-mono text-xs">#{o.order_id.slice(-8).toUpperCase()}</td>
                      <td className="p-3">
                        <div className="font-semibold">{o.customer_name}</div>
                        <div className="text-xs text-txt-secondary">{o.customer_email}</div>
                      </td>
                      <td className="p-3 text-xs">{formatDateTime(o.created_at)}</td>
                      <td className="p-3 text-right font-bold">{formatCurrency(o.total)}</td>
                      <td className="p-3 text-center"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="p-3 text-right">
                        <button onClick={() => setSelected(o)} className="p-2 hover:bg-bg-secondary rounded" data-testid={`view-order-${o.order_id}`}><Eye className="w-4 h-4" /></button>
                        <button onClick={() => deleteOrder(o)} className="p-2 hover:bg-red-50 rounded ml-1" data-testid={`delete-order-${o.order_id}`} title="Deletar pedido"><Trash2 className="w-4 h-4 text-red-500" /></button>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-txt-secondary">Nenhum pedido.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} pages={pages} total={total} limit={PAGE_LIMIT} onChange={(p) => load(p)} testId="orders-pagination" />
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-border p-5 flex items-center justify-between">
              <h2 className="font-heading font-black text-lg">Pedido #{selected.order_id.slice(-8).toUpperCase()}</h2>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-txt-secondary text-xs">Cliente</div><div className="font-bold">{selected.customer_name}</div><div className="text-xs">{selected.customer_email}</div></div>
                <div><div className="text-txt-secondary text-xs">Pagamento</div><div className="font-bold">{selected.payment_method}</div><div className="text-xs">{selected.payment_status}</div></div>
              </div>

              <div>
                <div className="text-txt-secondary text-xs mb-1">Endereço</div>
                <div className="text-sm">
                  {selected.shipping_address?.street}, {selected.shipping_address?.number} - {selected.shipping_address?.neighborhood}<br />
                  {selected.shipping_address?.city}/{selected.shipping_address?.state} · CEP {selected.shipping_address?.zip_code}
                </div>
              </div>

              <div>
                <div className="text-txt-secondary text-xs mb-2">Itens</div>
                <div className="space-y-2">
                  {selected.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-bg-secondary rounded">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-bold">{formatCurrency(it.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selected.affiliate_id && (
                <div className="bg-brand-light border border-brand-main/20 rounded-lg p-3 text-sm">
                  <div className="font-bold text-brand-main">Comissão de afiliado</div>
                  <div className="text-xs">Código {selected.affiliate_code} · {formatCurrency(selected.affiliate_commission)}</div>
                </div>
              )}

              {selected.invoice_number ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-emerald-700 font-semibold">Nota emitida</div>
                    <div className="font-mono font-bold">{selected.invoice_number}</div>
                  </div>
                  <a href={`/pedido/${selected.order_id}/nota`} target="_blank" rel="noreferrer" className="text-brand-main font-semibold text-sm hover:underline" data-testid="admin-view-invoice">
                    Ver / Imprimir
                  </a>
                </div>
              ) : (selected.order_status === 'paid' || selected.order_status === 'shipped' || selected.order_status === 'delivered') ? (
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    await api.post(`/api/admin/orders/${selected.order_id}/issue-invoice`);
                    toast.success('Nota emitida');
                    await load(page);
                    const updated = orders.find(x => x.order_id === selected.order_id);
                    if (updated) setSelected(updated);
                  } catch (err) { toast.error(err.message); }
                }} data-testid="issue-invoice-btn">Emitir nota de faturamento</Button>
              ) : null}

              <div className="space-y-1 text-sm pt-3 border-t border-border">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div>
                <div className="flex justify-between"><span>Frete</span><span>{formatCurrency(selected.shipping_cost)}</span></div>
                <div className="flex justify-between font-black pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(selected.total)}</span></div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="text-sm font-bold mb-2">Atualizar status</div>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(st => (
                    <button
                      key={st}
                      onClick={() => updateStatus(selected.order_id, st)}
                      disabled={selected.order_status === st}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${selected.order_status === st ? 'bg-brand-main text-white border-brand-main' : 'border-border hover:bg-bg-secondary'}`}
                      data-testid={`set-status-${st}`}
                    >
                      {STATUSES.find(s => s.value === st)?.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zona de perigo */}
              <div className="mt-6 pt-4 border-t border-red-200">
                <h3 className="text-sm font-bold text-red-600 mb-2">Zona de perigo</h3>
                <p className="text-xs text-txt-secondary mb-3">Deletar um pedido remove todas as comissões, pontos e logs gerados por ele, e reverte estoque e cupom.</p>
                <Button variant="outline" onClick={() => deleteOrder(selected)} className="border-red-300 text-red-600 hover:bg-red-50" data-testid="delete-order-modal-btn">
                  <Trash2 className="w-4 h-4" /> Deletar pedido permanentemente
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
