import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Ticket, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const COUPON_KEY = 'oxx_coupon_v1';

export default function CartPage() {
  const { cart, updateItem, removeItem, loading } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(null);

  // Cupom
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COUPON_KEY) || 'null'); } catch { return null; }
  });
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = cart.subtotal || 0;
  const shipping = subtotal > 0 ? 15.90 : 0;
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
              <div className="flex justify-between">
                <span className="text-txt-secondary">Frete</span>
                <span className="font-semibold">{formatCurrency(shipping)}</span>
              </div>
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
