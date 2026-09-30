import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { canSeeProductPoints, formatPointsLabel } from '../../lib/pointsVisibility';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, Package, MapPin, Loader2, Award, Truck, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABELS = {
  pending: { label: 'Aguardando pagamento', variant: 'warning' },
  paid: { label: 'Pago', variant: 'success' },
  separating: { label: 'Em separação', variant: 'warning' },
  shipped: { label: 'Enviado', variant: 'info' },
  available_for_pickup: { label: 'Disponível para retirada', variant: 'info' },
  delivered: { label: 'Entregue', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'error' },
};

export default function OrderDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const settings = useSiteSettings();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payCfg, setPayCfg] = useState({ environment: 'test', configured: false });

  const load = async () => {
    try {
      const [o, cfg] = await Promise.all([
        api.get(`/api/orders/${id}`),
        api.get('/api/payments/config'),
      ]);
      setOrder(o);
      setPayCfg(cfg);
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
            {order.payment_url ? (
              <>
                <p className="text-sm text-amber-800 mb-3">
                  <strong>Pagamento pendente.</strong> Clique no botão abaixo para concluir o pagamento via {order.payment_provider === 'ipag' ? 'iPag Gateway' : 'MercadoPago'}.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <a href={order.payment_url} target="_blank" rel="noreferrer">
                    <Button size="sm" data-testid="pay-btn">
                      Pagar com {order.payment_provider === 'ipag' ? 'iPag' : 'MercadoPago'}
                    </Button>
                  </a>
                  {order.boleto_url && (
                    <a href={order.boleto_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" data-testid="pay-boleto-btn">
                        Imprimir Boleto
                      </Button>
                    </a>
                  )}
                </div>
              </>
            ) : order.pix_qrcode ? (
              <div className="text-center space-y-2">
                <p className="text-sm text-amber-800 font-bold">Escaneie o QR Code PIX para pagar:</p>
                {order.pix_qrcode_url && <img src={order.pix_qrcode_url} alt="QR Code Pix" className="w-48 h-48 mx-auto border rounded-lg bg-white p-2" />}
                <div className="bg-white p-2 border rounded font-mono text-xs break-all select-all">{order.pix_qrcode}</div>
              </div>
            ) : (
              <p className="text-sm text-amber-800">Aguardando confirmação do pagamento...</p>
            )}
            {(payCfg.provider === 'mock' || payCfg.environment === 'test' || payCfg.ipag_environment === 'sandbox' || order.payment_provider === 'mock') && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-xs text-amber-700 mb-2"><strong>Sandbox / Mock:</strong> em modo de teste, você pode simular a confirmação do pagamento.</p>
                <Button onClick={confirmMockPayment} loading={paying} size="sm" variant="outline" data-testid="mock-pay-btn">
                  Simular pagamento (sandbox)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Módulo de Rastreamento de Entrega Estilizado (Visual da Imagem de Referência) */}
      <OrderTrackingSection
        orderId={order.order_id}
        trackingCode={order.tracking_code}
        orderStatus={order.order_status}
      />

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
          {(() => {
            if (!canSeeProductPoints(user, settings)) return null;
            const totalPts = (order.items || []).reduce(
              (s, i) => s + (Number(i.points_value || 0) * Number(i.quantity || 0)),
              0
            );
            if (totalPts <= 0) return null;
            return (
              <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2" data-testid="order-points-total">
                <span className="text-amber-800 font-semibold inline-flex items-center gap-1.5 text-xs">
                  <Award className="w-4 h-4" /> Pontos ganhos
                </span>
                <span className="text-amber-800 font-bold text-sm">
                  {formatPointsLabel(totalPts, settings?.points_visibility_label || 'pontos')}
                </span>
              </div>
            );
          })()}
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


function OrderTrackingSection({ orderId, trackingCode, orderStatus }) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTracking = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get(`/api/orders/${orderId}/tracking`);
      setTracking(res);
      if (isManual) toast.success('Rastreamento atualizado!');
    } catch (err) {
      if (isManual) toast.error('Falha ao consultar rastreamento');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchTracking();
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [orderId]);

  if (!trackingCode && (!tracking || !tracking.has_tracking)) {
    return null;
  }

  const events = tracking?.events || [];
  const correiosUrl = tracking?.correios_url || `https://rastreamento.correios.com.br/app/index.php?codigo=${trackingCode}`;

  return (
    <div className="bg-[#F1F5F9] rounded-3xl p-6 md:p-8 mb-6 border border-slate-200 shadow-sm" data-testid="order-tracking-section">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#008069]/10 text-[#008069] rounded-2xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading font-black text-xl text-slate-900">Rastreamento de Entrega</h2>
            <p className="text-xs text-slate-500 font-medium">Pedido #{orderId.slice(-8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Top Box Código & Ações */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 mb-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-400">CÓDIGO DE RASTREIO</span>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-3 py-0.5 rounded-full inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> API Correios Ao Vivo
            </span>
          </div>
          <div className="font-mono font-black text-xl text-slate-900 tracking-wide">
            {trackingCode || tracking?.tracking_code || '—'}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">
            Transportador: <b className="text-slate-700">{tracking?.carrier || 'Correios'}</b>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => fetchTracking(true)}
            disabled={refreshing}
            className="flex-1 md:flex-none bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
            data-testid="refresh-tracking-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <a
            href={correiosUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 md:flex-none bg-[#008069] hover:bg-[#006e5a] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-md"
            data-testid="correios-site-btn"
          >
            Site Correios <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Histórico de Movimentação */}
      <div>
        <h3 className="font-heading font-black text-xs text-slate-700 tracking-wider uppercase mb-6">
          HISTÓRICO DE MOVIMENTAÇÃO
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin inline text-[#008069] mr-2" />
            Buscando movimentações em tempo real...
          </div>
        ) : events.length === 0 ? (
          <div className="p-4 bg-white rounded-xl text-xs text-slate-500 text-center border">
            Nenhuma movimentação registrada ainda.
          </div>
        ) : (
          <div className="relative pl-8 space-y-6 before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-emerald-400">
            {events.map((ev, idx) => (
              <div key={idx} className="relative">
                {/* Node Icon Check */}
                <div className="absolute -left-8 top-0 w-7 h-7 bg-[#008069] text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                  ✓
                </div>

                <div className="bg-white/90 p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <span className="font-heading font-bold text-sm text-slate-900">{ev.status}</span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {ev.date} {ev.time ? `às ${ev.time}` : ''}
                    </span>
                  </div>
                  {ev.location && (
                    <div className="text-xs font-bold text-[#008069] mt-0.5">{ev.location}</div>
                  )}
                  {ev.description && (
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">{ev.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
