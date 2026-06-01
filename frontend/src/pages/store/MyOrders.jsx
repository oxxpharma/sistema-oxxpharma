import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Package, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';

const STATUS_LABELS = {
  pending: { label: 'Aguardando pagamento', variant: 'warning' },
  paid: { label: 'Pago', variant: 'success' },
  separating: { label: 'Em separação', variant: 'warning' },
  shipped: { label: 'Enviado', variant: 'info' },
  available_for_pickup: { label: 'Disponível para retirada', variant: 'info' },
  delivered: { label: 'Entregue', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'error' },
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { orders } = await api.get('/api/orders');
        setOrders(orders || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" data-testid="my-orders">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-6 flex items-center gap-3"><Package className="w-7 h-7 text-brand-main" /> Meus pedidos</h1>
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto text-txt-secondary mb-3" />
          <p className="text-txt-secondary">Você ainda não fez nenhum pedido.</p>
          <Link to="/"><Button className="mt-4">Começar a comprar</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const s = STATUS_LABELS[o.order_status] || STATUS_LABELS.pending;
            return (
              <Link key={o.order_id} to={`/pedido/${o.order_id}`} className="block bg-white rounded-xl border border-border p-5 hover:border-brand-main/40 hover:shadow-md transition" data-testid={`order-${o.order_id}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-xs text-txt-secondary">Pedido #{o.order_id.slice(-8).toUpperCase()}</div>
                    <div className="text-sm font-semibold mt-0.5">{formatDateTime(o.created_at)}</div>
                    <div className="text-xs text-txt-secondary mt-1">{o.items?.length || 0} itens</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.variant}>{s.label}</Badge>
                    <div className="font-heading font-black text-lg text-txt-primary">{formatCurrency(o.total)}</div>
                    <ArrowRight className="w-4 h-4 text-txt-secondary" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
