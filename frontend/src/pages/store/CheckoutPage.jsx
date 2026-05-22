import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useReferral } from '../../contexts/RefContext';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import AddressForm from '../../components/store/AddressForm';
import { MapPin, CreditCard, QrCode, FileText, Share2, Plus, Check, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import ShippingCalculator, { loadSelectedShipping, saveSelectedShipping } from '../../components/store/ShippingCalculator';
import FreeShippingProgress from '../../components/store/FreeShippingProgress';
import { evaluateFreeShipping } from '../../lib/freeShipping';

const emptyAddr = { label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', state: 'SP', zip_code: '', is_default: true };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, clear } = useCart();
  const { user } = useAuth();
  const { refCode, refName, clearRef } = useReferral();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState(emptyAddr);
  const [selectedShipping, setSelectedShipping] = useState(() => loadSelectedShipping());
  // Iter 38: Voucher pre-pago vindo da Maxx
  const [voucherBalance, setVoucherBalance] = useState(0);
  const [useVoucher, setUseVoucher] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await api.get('/api/users/me/voucher');
        setVoucherBalance(Number(v?.balance || 0));
      } catch { /* noop */ }
    })();
  }, []);

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
      let couponCode;
      try {
        const c = JSON.parse(localStorage.getItem('oxx_coupon_v1') || 'null');
        if (c?.code) couponCode = c.code;
      } catch { /* noop */ }
      const order = await api.post('/api/checkout', {
        address_id: selectedAddr,
        payment_method: paymentMethod,
        ref_code: refCode || undefined,
        coupon_code: couponCode,
        voucher_amount: voucherToUse > 0 ? Number(voucherToUse.toFixed(2)) : undefined,
        shipping_price: selectedShipping?.free_shipping ? 0 : (selectedShipping ? Number(selectedShipping.price) : undefined),
        shipping_service_name: selectedShipping?.name,
        shipping_carrier: selectedShipping?.carrier,
        shipping_service_id: selectedShipping?.id,
        shipping_delivery_days: selectedShipping?.delivery_days,
      });
      // Cria preferencia de pagamento (ou marca pago direto se voucher cobriu tudo)
      const pay = await api.post(`/api/payments/create/${order.order_id}`);
      clear();
      clearRef();
      try { localStorage.removeItem('oxx_coupon_v1'); } catch { /* noop */ }
      try { saveSelectedShipping(null); } catch { /* noop */ }
      // Iter 38: Pagamento totalmente coberto pelo voucher -> sem redirecionar a MP
      if (pay.provider === 'voucher' || pay.paid) {
        toast.success('Pedido pago com saldo voucher!');
        navigate(`/pedido/${order.order_id}`);
        return;
      }
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

  const settings = useSiteSettings();
  const subtotal = cart.subtotal || 0;
  // Iter 42h: helper unificado (suporta multiplas regras OR + legacy)
  const fsEval = evaluateFreeShipping(settings, user, subtotal);
  const isFreeShippingByRule = subtotal > 0 && fsEval.applies;
  const fsThreshold = fsEval.threshold || 0;
  const remainingForFree = fsEval.remaining || 0;
  const shipping = isFreeShippingByRule
    ? 0
    : (selectedShipping?.free_shipping ? 0 : Number(selectedShipping?.price || 0));
  const couponDiscount = (() => {
    try {
      const c = JSON.parse(localStorage.getItem('oxx_coupon_v1') || 'null');
      return Number(c?.discount || 0);
    } catch { return 0; }
  })();
  const grandBeforeVoucher = Math.max(0, subtotal + shipping - couponDiscount);
  // Iter 38: Voucher abate ate o valor total. Se cobrir tudo, total = 0 e nao vai ao MP.
  const voucherToUse = useVoucher ? Math.min(voucherBalance, grandBeforeVoucher) : 0;
  const total = Math.max(0, grandBeforeVoucher - voucherToUse);
  const fullyCoveredByVoucher = useVoucher && voucherToUse >= grandBeforeVoucher && grandBeforeVoucher > 0;

  // CEP do endereço selecionado (para auto-cotação ao entrar no checkout / trocar endereço)
  const selectedAddrObj = addresses.find(a => a.address_id === selectedAddr);
  const selectedAddrCep = selectedAddrObj?.zip_code || '';

  // Iter 45: GARANTIA de CPF e CEP - exigidos antes do checkout
  const userCpfDigits = (user?.cpf_digits || (user?.cpf || '').replace(/\D/g, '') || '');
  const hasCpf = userCpfDigits.length >= 11;
  const selectedAddrZipDigits = (selectedAddrObj?.zip_code || '').replace(/\D/g, '');
  const hasValidCep = selectedAddrZipDigits.length === 8;
  const canCheckout = hasCpf && hasValidCep && selectedAddr;

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="checkout-page">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-6">Finalizar compra</h1>

      {refName && (
        <div className="bg-brand-light border border-brand-main/20 rounded-xl p-4 flex items-center gap-3 mb-6" data-testid="checkout-ref-info">
          <Share2 className="w-5 h-5 text-brand-main" />
          <div className="text-sm">
            <div className="font-semibold text-brand-main">Compra indicada por {refName}</div>
            <div className="text-xs text-txt-secondary">Sua compra gerará cashback para o afiliado.</div>
          </div>
        </div>
      )}

      {/* Iter 45: bloqueio claro quando CPF nao esta no cadastro */}
      {!hasCpf && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 flex items-start gap-3 mb-6" data-testid="checkout-need-cpf">
          <FileText className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <div className="font-bold text-rose-700">CPF obrigatório para finalizar a compra</div>
            <div className="text-rose-700/80 text-xs mt-1">
              Precisamos do seu CPF para emitir corretamente a nota e o pedido.
            </div>
          </div>
          <Link to="/minha-conta" className="text-xs font-bold bg-rose-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap" data-testid="checkout-fill-cpf-btn">
            Cadastrar CPF
          </Link>
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

            {/* Iter 38: Saldo Voucher pre-pago */}
            {voucherBalance > 0 && (
              <div
                className={`mb-4 rounded-xl border p-4 transition ${useVoucher ? 'border-emerald-400 bg-emerald-50' : 'border-border bg-bg-secondary/40'}`}
                data-testid="voucher-card"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${useVoucher ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-bold text-sm">Saldo Voucher disponível</div>
                      <div className="font-heading font-black text-emerald-600 text-lg" data-testid="voucher-balance">
                        {formatCurrency(voucherBalance)}
                      </div>
                    </div>
                    <p className="text-xs text-txt-secondary mt-0.5">
                      Use seu saldo pré-pago para abater do total. Se não cobrir tudo, o restante é cobrado pelo Mercado Pago.
                    </p>
                    <label className="mt-3 flex items-center gap-2 cursor-pointer select-none" data-testid="voucher-toggle-label">
                      <input
                        type="checkbox"
                        checked={useVoucher}
                        onChange={(e) => setUseVoucher(e.target.checked)}
                        className="w-4 h-4 accent-emerald-500"
                        data-testid="voucher-toggle"
                      />
                      <span className="text-sm font-semibold">
                        Usar saldo voucher neste pedido
                      </span>
                    </label>
                    {useVoucher && (
                      <div className="mt-2 text-xs bg-white rounded-lg border border-emerald-200 p-2">
                        <div className="flex justify-between">
                          <span className="text-txt-secondary">Voucher aplicado</span>
                          <span className="font-bold text-emerald-600">−{formatCurrency(voucherToUse)}</span>
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-txt-secondary">Restante a pagar</span>
                          <span className="font-bold">{formatCurrency(total)}</span>
                        </div>
                        {fullyCoveredByVoucher && (
                          <div className="mt-1 text-emerald-700 font-semibold">
                            ✓ Voucher cobre todo o pedido — sem cobrança no cartão.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!fullyCoveredByVoucher && (
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
            )}
            <p className="text-xs text-txt-secondary mt-3 bg-bg-secondary p-3 rounded-lg">
              <strong>Nota:</strong> {fullyCoveredByVoucher
                ? 'Como o saldo voucher cobre todo o pedido, nenhuma cobrança será feita no cartão.'
                : 'O pagamento será processado via Mercado Pago.'}
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

              {/* Calculadora de frete (auto-calcula pelo CEP do endereço selecionado) */}
              {!isFreeShippingByRule && selectedAddr && (
                <div className="pt-2 pb-2">
                  <ShippingCalculator
                    items={cart.items}
                    subtotal={subtotal}
                    initialCep={selectedAddrCep}
                    readOnlyCep
                    autoCalculate
                    onSelect={(opt) => setSelectedShipping(opt)}
                  />
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-txt-secondary">Frete</span>
                {isFreeShippingByRule ? (
                  <span className="font-semibold text-emerald-600">{settings?.free_shipping_label || 'Frete grátis'}</span>
                ) : selectedShipping ? (
                  <span>
                    {selectedShipping.free_shipping ? (
                      <span className="text-emerald-600 font-semibold">{selectedShipping.free_shipping_label || 'Grátis'}</span>
                    ) : formatCurrency(shipping)}
                    <span className="text-[11px] text-txt-secondary ml-1">({selectedShipping.name})</span>
                  </span>
                ) : (
                  <span className="text-xs text-txt-secondary">selecione uma opção</span>
                )}
              </div>
              {(remainingForFree > 0 || isFreeShippingByRule) && subtotal > 0 && fsThreshold > 0 && (
                <FreeShippingProgress
                  subtotal={subtotal}
                  threshold={fsThreshold}
                  remaining={remainingForFree}
                  applies={isFreeShippingByRule}
                  label={settings?.free_shipping_label || 'Frete grátis'}
                  compact
                />
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Cupom</span><span className="font-semibold">−{formatCurrency(couponDiscount)}</span></div>
              )}
              {voucherToUse > 0 && (
                <div className="flex justify-between text-emerald-600" data-testid="summary-voucher-line">
                  <span>Voucher aplicado</span>
                  <span className="font-semibold">−{formatCurrency(voucherToUse)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-baseline pt-3 border-t border-border">
              <span className="font-bold">Total</span>
              <span className="font-heading font-black text-2xl text-brand-main">{formatCurrency(total)}</span>
            </div>
            <Button onClick={submit} loading={submitting} className="w-full mt-5" size="lg" data-testid="confirm-order-btn" disabled={!canCheckout || (!isFreeShippingByRule && !selectedShipping)}>
              Confirmar pedido
            </Button>
            {!canCheckout && (
              <div className="mt-3 text-[11px] text-rose-600 font-semibold text-center" data-testid="checkout-block-reason">
                {!hasCpf
                  ? 'É preciso cadastrar seu CPF antes de finalizar o pedido.'
                  : !hasValidCep
                    ? 'O endereço selecionado está sem CEP válido (8 dígitos).'
                    : 'Selecione um endereço de entrega.'}
              </div>
            )}
            <Link to="/carrinho" className="block text-center mt-3 text-xs text-txt-secondary">Voltar ao carrinho</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
