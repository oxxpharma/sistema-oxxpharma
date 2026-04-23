import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, Package, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABELS = {
  pending: { label: 'Aguardando pagamento', variant: 'warning' },
  paid: { label: 'Pago', variant: 'success' },
  shipped: { label: 'Enviado', variant: 'info' },
  delivered: { label: 'Entregue', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'error' },
};

export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const o = await api.get(`/api/orders/${id}`);
      setOrder(o);
    } catch (err) {
      toast.error('Pedido não encontrado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const confirmMockPayment = async () => {
    setPaying(true);
    try {
      await api.post(`/api/payments/mock/confirm/${id}`);
      toast.success('Pagamento confirmado (modo desenvolvimento)');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!order) return <div className="p-10 text-center">Pedido não encontrado.</div>;

  const status = STATUS_LABELS[order.order_status] || STATUS_LABELS.pending;
  const isPending = order.payment_status === 'pending';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="order-details">
      <div className="bg-white rounded-xl border border-border p-6 md:p-8 text-center mb-6">
        <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary">Pedido realizado!</h1>
        <p className="text-sm text-txt-secondary mt-2">
          Número do pedido: <span className="font-mono font-bold">#{order.order_id.slice(-8).toUpperCase()}</span>
        </p>
        <div className="mt-3 flex justify-center">
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        {order.invoice_number && (
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between gap-3" data-testid="invoice-banner">
            <div className="text-left">
              <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Nota de faturamento</div>
              <div className="font-mono font-black text-lg text-emerald-900">{order.invoice_number}</div>
            </div>
            <Link to={`/pedido/${order.order_id}/nota`} target="_blank">
              <Button variant="outline" size="sm" data-testid="view-invoice-btn">Ver nota</Button>
            </Link>
          </div>
        )}
        {isPending && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
            <p className="text-sm text-amber-800 mb-3">
              <strong>Modo desenvolvimento:</strong> integração Mercado Pago ainda não ativada. Clique abaixo para simular a confirmação do pagamento.
            </p>
            <Button onClick={confirmMockPayment} loading={paying} size="sm" data-testid="mock-pay-btn">
              Simular pagamento
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border p-6 mb-6">
        <h2 className="font-heading font-black text-lg mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-brand-main" /> Itens</h2>
        <div className="space-y-3">
          {order.items.map((it, i) => (
            <div key={i} className="flex gap-3 items-center">
              <img src={it.image || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=100'} alt="" className="w-14 h-14 rounded-lg object-cover bg-bg-secondary" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{it.name}</div>
                <div className="text-xs text-txt-secondary">{it.quantity}x {formatCurrency(it.price)}</div>
              </div>
              <div className="font-bold">{formatCurrency(it.total)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-txt-secondary">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-txt-secondary">Frete</span><span>{formatCurrency(order.shipping_cost)}</span></div>
          <div className="flex justify-between items-baseline pt-2 border-t border-border">
            <span className="font-bold">Total</span>
            <span className="font-heading font-black text-2xl text-brand-main">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-6 mb-6">
        <h2 className="font-heading font-black text-lg mb-3 flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-main" /> Entrega</h2>
        <div className="text-sm text-txt-secondary">
          {order.shipping_address?.street}, {order.shipping_address?.number}
          {order.shipping_address?.complement ? ` - ${order.shipping_address.complement}` : ''}
          <br />
          {order.shipping_address?.neighborhood} · {order.shipping_address?.city}/{order.shipping_address?.state}
          <br />
          CEP {order.shipping_address?.zip_code}
        </div>
      </div>

      <div className="text-center text-xs text-txt-secondary mb-6">
        Realizado em {formatDateTime(order.created_at)}
      </div>

      <div className="flex gap-3 justify-center">
        <Link to="/meus-pedidos"><Button variant="outline" data-testid="view-orders-btn">Meus pedidos</Button></Link>
        <Link to="/"><Button data-testid="continue-shopping-btn">Continuar comprando</Button></Link>
      </div>
    </div>
  );
}
