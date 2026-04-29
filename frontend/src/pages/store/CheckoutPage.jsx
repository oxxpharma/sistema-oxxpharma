import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCart } from '../../contexts/CartContext';
import { useReferral } from '../../contexts/RefContext';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import AddressForm from '../../components/store/AddressForm';
import { MapPin, CreditCard, QrCode, FileText, Share2, Plus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyAddr = { label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', state: 'SP', zip_code: '', is_default: true };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, clear } = useCart();
  const { refCode, refName, clearRef } = useReferral();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState(emptyAddr);

  useEffect(() => {
    (async () => {
      try {
        const { addresses: addrs } = await api.get('/api/users/me/addresses');
        setAddresses(addrs || []);
        const def = addrs?.find(a => a.is_default) || addrs?.[0];
        if (def) setSelectedAddr(def.address_id);
        else setShowNewAddr(true);
      } catch {
        setShowNewAddr(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading && !cart.items.length) {
      navigate('/carrinho');
    }
  }, [loading, cart.items.length, navigate]);

  const addAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/users/me/addresses', newAddr);
      setAddresses(res.addresses);
      const last = res.addresses[res.addresses.length - 1];
      setSelectedAddr(last.address_id);
      setShowNewAddr(false);
      toast.success('Endereço adicionado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submit = async () => {
    if (!selectedAddr) { toast.error('Selecione um endereço'); return; }
    setSubmitting(true);
    try {
      const order = await api.post('/api/checkout', {
        address_id: selectedAddr,
        payment_method: paymentMethod,
        ref_code: refCode || undefined,
      });
      // Cria preferencia de pagamento
      const pay = await api.post(`/api/payments/create/${order.order_id}`);
      clear();
      clearRef();
      // Se MP ativo e tem URL de pagamento, redireciona pro checkout do MP
      if (pay.provider === 'mercadopago' && pay.payment_url) {
        toast.success('Redirecionando para o pagamento...');
        window.location.href = pay.payment_url;
        return;
      }
      toast.success('Pedido criado com sucesso!');
      navigate(`/pedido/${order.order_id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const shipping = 15.90;
  const total = (cart.subtotal || 0) + shipping;

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="checkout-page">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-6">Finalizar compra</h1>

      {refName && (
        <div className="bg-brand-light border border-brand-main/20 rounded-xl p-4 flex items-center gap-3 mb-6" data-testid="checkout-ref-info">
          <Share2 className="w-5 h-5 text-brand-main" />
          <div className="text-sm">
            <div className="font-semibold text-brand-main">Compra indicada por {refName}</div>
            <div className="text-xs text-txt-secondary">Sua compra gerará comissão para o afiliado.</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Endereço */}
          <section className="bg-white rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-black text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-main" /> Endereço de entrega</h2>
              {addresses.length > 0 && !showNewAddr && (
                <button onClick={() => setShowNewAddr(true)} className="text-sm text-brand-main font-semibold flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Novo endereço
                </button>
              )}
            </div>

            {!showNewAddr && addresses.length > 0 && (
              <div className="space-y-2" data-testid="addresses-list">
                {addresses.map(a => (
                  <button
                    key={a.address_id}
                    onClick={() => setSelectedAddr(a.address_id)}
                    className={`w-full text-left p-4 rounded-lg border transition ${selectedAddr === a.address_id ? 'border-brand-main bg-brand-light/50' : 'border-border hover:border-brand-main/40'}`}
                    data-testid={`addr-${a.address_id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-sm text-txt-primary">{a.label || 'Endereço'}</div>
                        <div className="text-sm text-txt-secondary mt-0.5">
                          {a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ''} · {a.neighborhood}
                        </div>
                        <div className="text-sm text-txt-secondary">{a.city}/{a.state} · CEP {a.zip_code}</div>
                      </div>
                      {selectedAddr === a.address_id && <Check className="w-5 h-5 text-brand-main flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showNewAddr && (
              <form onSubmit={addAddress} className="space-y-3" data-testid="new-addr-form">
                <AddressForm value={newAddr} onChange={setNewAddr} showDefault={false} />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" data-testid="save-addr-btn">Salvar endereço</Button>
                  {addresses.length > 0 && (
                    <Button type="button" variant="ghost" onClick={() => setShowNewAddr(false)}>Cancelar</Button>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* Pagamento */}
          <section className="bg-white rounded-xl border border-border p-6">
            <h2 className="font-heading font-black text-lg mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-brand-main" /> Forma de pagamento</h2>
            <div className="space-y-2">
              {[
                { id: 'pix', icon: QrCode, name: 'PIX', desc: 'Pagamento instantâneo' },
                { id: 'credit_card', icon: CreditCard, name: 'Cartão de crédito', desc: 'Parcele em até 6x' },
                { id: 'boleto', icon: FileText, name: 'Boleto bancário', desc: 'Vence em 3 dias úteis' },
              ].map(pm => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`w-full text-left p-4 rounded-lg border transition flex items-center gap-3 ${paymentMethod === pm.id ? 'border-brand-main bg-brand-light/50' : 'border-border hover:border-brand-main/40'}`}
                  data-testid={`pm-${pm.id}`}
                >
                  <pm.icon className="w-5 h-5 text-brand-main" />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{pm.name}</div>
                    <div className="text-xs text-txt-secondary">{pm.desc}</div>
                  </div>
                  {paymentMethod === pm.id && <Check className="w-5 h-5 text-brand-main" />}
                </button>
              ))}
            </div>
            <p className="text-xs text-txt-secondary mt-3 bg-bg-secondary p-3 rounded-lg">
              <strong>Nota:</strong> O pagamento real será processado via Mercado Pago assim que integrado. Por ora, o pedido é criado em modo de desenvolvimento.
            </p>
          </section>
        </div>

        {/* Resumo */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-border p-6 sticky top-24" data-testid="checkout-summary">
            <h2 className="font-heading font-black text-lg mb-4">Resumo</h2>
            <div className="max-h-48 overflow-y-auto space-y-2 pb-3 border-b border-border">
              {cart.items.map(it => (
                <div key={it.product_id} className="flex gap-2 text-xs">
                  <img src={it.image || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=100'} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{it.name}</div>
                    <div className="text-txt-secondary">{it.quantity}x {formatCurrency(it.price)}</div>
                  </div>
                  <div className="font-bold">{formatCurrency(it.total)}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 py-3 text-sm">
              <div className="flex justify-between"><span className="text-txt-secondary">Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-txt-secondary">Frete</span><span>{formatCurrency(shipping)}</span></div>
            </div>
            <div className="flex justify-between items-baseline pt-3 border-t border-border">
              <span className="font-bold">Total</span>
              <span className="font-heading font-black text-2xl text-brand-main">{formatCurrency(total)}</span>
            </div>
            <Button onClick={submit} loading={submitting} className="w-full mt-5" size="lg" data-testid="confirm-order-btn" disabled={!selectedAddr}>
              Confirmar pedido
            </Button>
            <Link to="/carrinho" className="block text-center mt-3 text-xs text-txt-secondary">Voltar ao carrinho</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
