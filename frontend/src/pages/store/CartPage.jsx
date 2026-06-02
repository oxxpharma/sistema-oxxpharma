import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Ticket, X, Loader2, Award, Store, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import ShippingCalculator, { loadSelectedShipping, saveSelectedShipping } from '../../components/store/ShippingCalculator';
import FreeShippingProgress from '../../components/store/FreeShippingProgress';
import { evaluateFreeShipping } from '../../lib/freeShipping';
import { canSeeProductPoints, formatPointsLabel } from '../../lib/pointsVisibility';

const COUPON_KEY = 'oxx_coupon_v1';
const PICKUP_KEY = 'oxx_pickup_v1';

export default function CartPage() {
  const { cart, updateItem, removeItem, loading } = useCart();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(null);
  const settings = useSiteSettings();
  const [selectedShipping, setSelectedShipping] = useState(() => loadSelectedShipping());

  // Iter 47: opcao "Retirar no local" (estado compartilhado com Checkout via localStorage)
  const pickupCfg = settings?.pickup;
  const [pickup, setPickup] = useState(() => localStorage.getItem(PICKUP_KEY) === '1');
  useEffect(() => {
    localStorage.setItem(PICKUP_KEY, pickup ? '1' : '0');
  }, [pickup]);
  // Se o admin desligou pickup enquanto o usuario tinha marcado, limpa
  useEffect(() => {
    if (pickupCfg && !pickupCfg.enabled && pickup) setPickup(false);
  }, [pickupCfg?.enabled]);  // eslint-disable-line

  // Cupom
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COUPON_KEY) || 'null'); } catch { return null; }
  });
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = cart.subtotal || 0;

  // Iter 42h: usa novo helper que suporta multiplas regras OR (e legacy fallback)
  const fsEval = evaluateFreeShipping(settings, user, subtotal);
  const isFreeShippingByRule = subtotal > 0 && fsEval.applies;
  // Quando NÃO tem regra de frete grátis, usamos o valor da opção escolhida
  // pelo usuário. Se nada selecionado ainda, o frete fica "a calcular" (0 no resumo)
  const shipping = pickup
    ? 0
    : (subtotal === 0 || isFreeShippingByRule)
      ? 0
      : (selectedShipping?.free_shipping ? 0 : Number(selectedShipping?.price || 0));
  const remainingForFree = fsEval.remaining || 0;
  const fsThreshold = fsEval.threshold || 0;
  const discount = coupon?.discount || 0;
  const total = Math.max(0, subtotal + shipping - discount);

  // Re-valida cupom quando subtotal muda (item adicionado/removido)
  useEffect(() => {
    const code = coupon?.code;
    if (!code || subtotal <= 0) return;
    let alive = true;
    (async () => {
      try {
        const r = await api.post('/api/coupons/validate', { code, subtotal });
        if (!alive) return;
        if (r.valid) {
          setCoupon({ code, discount: r.discount, description: r.coupon?.description, type: r.coupon?.type, value: r.coupon?.value });
          localStorage.setItem(COUPON_KEY, JSON.stringify({ code, discount: r.discount }));
        } else {
          setCoupon(null);
          localStorage.removeItem(COUPON_KEY);
          toast.warning(r.reason || 'Cupom não é mais válido');
        }
      } catch { /* silencioso */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const onQty = async (pid, qty) => {
    setUpdating(pid);
    try { await updateItem(pid, qty); }
    catch (err) { toast.error(err.message); }
    finally { setUpdating(null); }
  };
  const onRemove = async (pid) => {
    try { await removeItem(pid); toast.success('Item removido'); } catch (err) { toast.error(err.message); }
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const r = await api.post('/api/coupons/validate', { code, subtotal });
      if (r.valid) {
        setCoupon({ code, discount: r.discount, description: r.coupon?.description, type: r.coupon?.type, value: r.coupon?.value });
        localStorage.setItem(COUPON_KEY, JSON.stringify({ code, discount: r.discount }));
        setCouponInput('');
        toast.success(`Cupom aplicado: -${formatCurrency(r.discount)}`);
      } else {
        toast.error(r.reason || 'Cupom inválido');
      }
    } catch (e) { toast.error(e?.message || 'Erro ao validar cupom'); }
    finally { setCouponLoading(false); }
  };

  const removeCoupon = () => {
    setCoupon(null);
    localStorage.removeItem(COUPON_KEY);
    toast.success('Cupom removido');
  };

  const goCheckout = () => {
    if (!isAuthenticated) { navigate('/login?redirect=/checkout'); return; }
    navigate('/checkout');
  };

  if (loading) return <div className="max-w-4xl mx-auto p-10 text-center">Carregando...</div>;

  if (!cart.items.length) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" data-testid="cart-empty">
        <div className="w-20 h-20 mx-auto bg-brand-light rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-brand-main" />
        </div>
        <h1 className="font-heading font-black text-2xl text-txt-primary">Seu carrinho está vazio</h1>
        <p className="text-sm text-txt-secondary mt-2">Explore nossos produtos e encontre o que precisa.</p>
        <Link to="/"><Button className="mt-6">Começar a comprar</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="cart-page">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-6">Meu carrinho</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {cart.items.map(item => (
            <div key={item.product_id} className="bg-white rounded-xl border border-border p-4 flex gap-4" data-testid={`cart-item-${item.product_id}`}>
              <img src={item.image || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200'} alt={item.name} className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover bg-bg-secondary" />
              <div className="flex-1 min-w-0">
                <Link to={`/produto/${item.product_id}`} className="font-semibold text-sm text-txt-primary line-clamp-2 hover:text-brand-main">{item.name}</Link>
                <div className="flex items-baseline gap-2 mt-1">
                  <div className="text-lg font-heading font-black text-txt-primary">{formatCurrency(item.price)}</div>
                  {item.original_price && item.original_price > item.price && (
                    <div className="text-xs line-through text-txt-secondary">{formatCurrency(item.original_price)}</div>
                  )}
                </div>
                {item.tier_applied && (
                  <div className="inline-block text-[10px] uppercase tracking-wider bg-brand-light text-brand-main rounded-full px-2 py-0.5 mt-1 font-bold">
                    Preço especial
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-border rounded-lg">
                    <button onClick={() => onQty(item.product_id, item.quantity - 1)} disabled={updating === item.product_id} className="w-8 h-8 flex items-center justify-center hover:bg-bg-secondary">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => onQty(item.product_id, item.quantity + 1)} disabled={updating === item.product_id || item.quantity >= (item.stock || 999)} className="w-8 h-8 flex items-center justify-center hover:bg-bg-secondary">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => onRemove(item.product_id)} className="text-txt-secondary hover:text-red-500 p-1" data-testid={`remove-${item.product_id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-right hidden md:block">
                <div className="text-xs text-txt-secondary">Subtotal</div>
                <div className="font-heading font-black text-lg">{formatCurrency(item.total)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-border p-6 sticky top-24" data-testid="cart-summary">
            <h2 className="font-heading font-black text-lg mb-4">Resumo</h2>

            {/* Cupom */}
            <div className="mb-4 pb-4 border-b border-border">
              <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary block mb-2">Cupom de desconto</label>
              {coupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Ticket className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-emerald-700 truncate">{coupon.code}</div>
                      <div className="text-[11px] text-emerald-700">−{formatCurrency(coupon.discount)} aplicado</div>
                    </div>
                  </div>
                  <button onClick={removeCoupon} className="text-emerald-700 hover:text-emerald-900 p-1" data-testid="remove-coupon-btn">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                    placeholder="DIGITE O CÓDIGO"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-brand-main"
                    data-testid="coupon-input"
                  />
                  <Button size="sm" variant="outline" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()} data-testid="apply-coupon-btn">
                    {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-txt-secondary">Subtotal ({cart.count} itens)</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>

              {/* Iter 42k: pontos ganhos com este pedido (se elegivel) */}
              {(() => {
                if (!canSeeProductPoints(user, settings)) return null;
                const totalPts = (cart.items || []).reduce(
                  (s, i) => s + (Number(i.points_value || 0) * Number(i.quantity || 0)),
                  0
                );
                if (totalPts <= 0) return null;
                return (
                  <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="cart-points-total">
                    <span className="text-amber-800 font-semibold inline-flex items-center gap-1.5 text-xs">
                      <Award className="w-4 h-4" /> Você ganhará neste pedido
                    </span>
                    <span className="text-amber-800 font-bold text-sm">
                      {formatPointsLabel(totalPts, settings?.points_visibility_label || 'pontos')}
                    </span>
                  </div>
                );
              })()}

              {/* Iter 47: Toggle Retirada no local */}
              {pickupCfg?.enabled && (
                <div className={`pt-3 pb-3 border-t border-border ${pickup ? '' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setPickup(!pickup)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition flex items-start gap-3 ${pickup ? 'border-orange-500 bg-orange-50' : 'border-border hover:border-orange-400/60'}`}
                    data-testid="toggle-pickup-cart"
                  >
                    <Store className={`w-6 h-6 shrink-0 mt-0.5 ${pickup ? 'text-orange-600' : 'text-txt-secondary'}`} />
                    <div className="flex-1">
                      <div className="font-bold text-sm flex items-center gap-2">
                        🏬 Quero retirar no local
                        {pickup && <span className="text-[10px] uppercase font-black bg-orange-600 text-white px-1.5 py-0.5 rounded">selecionado · frete grátis</span>}
                      </div>
                      <div className="text-xs text-txt-secondary mt-0.5">Sem custo de envio. Você retira na loja.</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 ${pickup ? 'border-orange-600 bg-orange-600' : 'border-gray-300'}`}>
                      {pickup && <div className="w-full h-full rounded-full border-2 border-white" />}
                    </div>
                  </button>
                  {pickup && (
                    <div className="mt-3 bg-white border border-orange-200 rounded-lg p-3 text-xs space-y-1.5" data-testid="pickup-info-cart">
                      <div className="font-bold text-orange-700 text-sm">📍 Local de retirada</div>
                      <div className="text-txt-primary">{pickupCfg.address}</div>
                      {pickupCfg.hours && <div className="text-txt-secondary"><span className="font-semibold">Horário:</span> {pickupCfg.hours}</div>}
                      {pickupCfg.phone && <div className="text-txt-secondary"><span className="font-semibold">Telefone:</span> {pickupCfg.phone}</div>}
                      {pickupCfg.instructions && <div className="text-txt-secondary italic">{pickupCfg.instructions}</div>}
                      <div className="mt-2 pt-2 border-t border-orange-200 flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50 -mx-3 -mb-3 px-3 py-2 rounded-b">
                        <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span><strong>Importante:</strong> apresente a fatura recebida por e-mail no ato da retirada.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Calculadora de frete */}
              {!pickup && !isFreeShippingByRule && subtotal > 0 && (
                <div className="pt-3 pb-3 border-t border-border">
                  <ShippingCalculator
                    items={cart.items}
                    subtotal={subtotal}
                    initialCep={selectedShipping?.cep || ''}
                    onSelect={(opt) => setSelectedShipping(opt)}
                  />
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-txt-secondary">Frete</span>
                {pickup ? (
                  <span className="font-semibold text-orange-600">Retirada no local</span>
                ) : isFreeShippingByRule ? (
                  <span className="font-semibold text-emerald-600">{settings?.free_shipping_label || 'Frete grátis'}</span>
                ) : selectedShipping ? (
                  <span className="font-semibold">
                    {selectedShipping.free_shipping ? (
                      <span className="text-emerald-600">{selectedShipping.free_shipping_label || 'Grátis'}</span>
                    ) : formatCurrency(shipping)}
                    <span className="text-[11px] text-txt-secondary ml-1">({selectedShipping.name})</span>
                  </span>
                ) : (
                  <span className="text-xs text-txt-secondary">calcule com seu CEP</span>
                )}
              </div>
              {(remainingForFree > 0 || isFreeShippingByRule) && subtotal > 0 && fsThreshold > 0 && (
                <FreeShippingProgress
                  subtotal={subtotal}
                  threshold={fsThreshold}
                  remaining={remainingForFree}
                  applies={isFreeShippingByRule}
                  label={settings?.free_shipping_label || 'Frete grátis'}
                />
              )}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Desconto</span>
                  <span className="font-semibold">−{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-border flex justify-between items-baseline">
                <span className="font-bold">Total</span>
                <span className="font-heading font-black text-2xl text-brand-main">{formatCurrency(total)}</span>
              </div>
            </div>
            <Button onClick={goCheckout} className="w-full mt-5" size="lg" data-testid="checkout-btn">
              Finalizar compra <ArrowRight className="w-4 h-4" />
            </Button>
            <Link to="/" className="block text-center mt-3 text-xs text-brand-main font-semibold">
              Continuar comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
