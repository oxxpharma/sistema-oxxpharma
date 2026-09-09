import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import ProductCard from '../../components/store/ProductCard';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { canSeeProductPoints, formatPointsLabel } from '../../lib/pointsVisibility';
import { evaluateFreeShipping } from '../../lib/freeShipping';
import FreeShippingProgress from '../../components/store/FreeShippingProgress';
import SEOHead from '../../components/SEOHead';
import { ShoppingCart, Truck, ShieldCheck, Minus, Plus, Loader2, ArrowLeft, Award, Check, Clock, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, cart } = useCart();
  const { user } = useAuth();
  const settings = useSiteSettings();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/products/${id}`);
        setProduct(data.product);
        setRelated(data.related || []);
      } catch (err) {
        toast.error('Produto não encontrado');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const addToCart = async () => {
    setAdding(true);
    try {
      await addItem(product.product_id, qty);
      toast.success('Adicionado ao carrinho');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const buyNow = async () => {
    setAdding(true);
    try {
      await addItem(product.product_id, qty);
      navigate('/carrinho');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>;
  if (!product) return <div className="max-w-3xl mx-auto p-10 text-center">Produto não encontrado.</div>;

  const tierApplied = product.tier_applied;
  const price = (typeof product.effective_price === 'number') ? product.effective_price : (product.discount_price || product.price);
  const original = (typeof product.original_price === 'number' && product.original_price > 0) ? product.original_price : (product.discount_price || product.price);
  const hasDiscount = price < (product.price || 0);
  const img = (product.images && product.images[0]) || PLACEHOLDER;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="product-details">
      <SEOHead
        title={`${product.name}${product.brand ? ' - ' + product.brand : ''} | OxxPharma`}
        description={(product.description || product.name || '').slice(0, 160)}
        canonical={`/produto/${product.product_id}`}
        image={img}
        type="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.name,
          "description": (product.description || '').slice(0, 500),
          "image": product.images || [],
          "sku": product.sku || product.product_id,
          "brand": product.brand ? { "@type": "Brand", "name": product.brand } : undefined,
          "offers": {
            "@type": "Offer",
            "priceCurrency": "BRL",
            "price": price,
            "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "url": typeof window !== 'undefined' ? window.location.href : undefined,
          },
        }}
      />
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-brand-main mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="grid md:grid-cols-2 gap-8 bg-white rounded-xl border border-border p-4 md:p-8 items-start">
        <div className="bg-bg-secondary rounded-xl overflow-hidden aspect-square md:sticky md:top-24 md:self-start" data-testid="product-image-wrap">
          <img src={img} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = PLACEHOLDER; }} />
        </div>

        <div>
          {product.brand && <Badge variant="brand" className="mb-2">{product.brand}</Badge>}
          <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary" data-testid="product-name">{product.name}</h1>
          {/* Iter 61: caracteristicas em toppicos abaixo do nome */}
          {Array.isArray(product.features) && product.features.length > 0 && (
            <ul className="mt-3 space-y-1.5" data-testid="product-features">
              {product.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-txt-primary">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
          {/* Iter 61: descricao rica (HTML se disponivel, senao texto puro) */}
          {product.description_html ? (
            <div
              className="prose prose-sm max-w-none mt-4 text-txt-primary"
              dangerouslySetInnerHTML={{ __html: product.description_html }}
              data-testid="product-description-html"
            />
          ) : (
            <p className="text-sm text-txt-secondary mt-3 leading-relaxed">{product.description}</p>
          )}
          {/* Iter 61: tempo de consumo */}
          {product.consumption_days > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-txt-secondary bg-bg-secondary rounded-full px-2.5 py-1" data-testid="product-consumption">
              <Clock className="w-3.5 h-3.5" />
              Dura aproximadamente <b className="text-txt-primary">{product.consumption_days} dia{product.consumption_days > 1 ? 's' : ''}</b>
            </div>
          )}

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-heading font-black text-4xl text-txt-primary" data-testid="product-price">{formatCurrency(price)}</span>
            {hasDiscount && <span className="text-base text-txt-secondary line-through">{formatCurrency(product.price)}</span>}
            {!hasDiscount && tierApplied && original > price && <span className="text-base text-txt-secondary line-through">{formatCurrency(original)}</span>}
          </div>
          {tierApplied && (
            <div className="mt-1 inline-block text-[11px] uppercase tracking-wider bg-brand-light text-brand-main rounded-full px-2.5 py-1 font-bold">
              {tierApplied.label || 'Preço especial para você'}
            </div>
          )}
          {hasDiscount && (
            <div className="text-sm text-emerald-600 font-semibold mt-1">
              Economize {formatCurrency((product.price || 0) - price)}
            </div>
          )}
          {/* Iter 39: preco do clube de beneficios sempre visivel */}
          {typeof product.club_price === 'number' && product.club_price > 0 && product.club_price < price && (
            <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm" data-testid="product-club-price">
              <Award className="w-4 h-4 text-emerald-600" />
              <span className="text-txt-secondary">Preço para participante do</span>
              <span className="font-bold text-emerald-700">Clube do Benefícios</span>
              <span className="text-txt-secondary">:</span>
              <span className="font-heading font-black text-emerald-700">{formatCurrency(product.club_price)}</span>
            </div>
          )}
          {canSeeProductPoints(user, settings) && product.points_value > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg" data-testid="product-points">
              <Award className="w-4 h-4" />
              Ganhe {formatPointsLabel(product.points_value, settings?.points_visibility_label || 'pontos')} nesta compra
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center border border-border rounded-lg">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-11 flex items-center justify-center hover:bg-bg-secondary" data-testid="qty-minus">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-semibold" data-testid="qty-value">{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="w-10 h-11 flex items-center justify-center hover:bg-bg-secondary" data-testid="qty-plus">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs text-txt-secondary">{product.stock > 0 ? `${product.stock} em estoque` : 'Sem estoque'}</span>
          </div>

          {/* Iter 61: combo pricing selector */}
          {Array.isArray(product.combo_pricing) && product.combo_pricing.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2" data-testid="combo-selector">
              {[{ qty: 1, price: price * 1, label: '1 un.', off: 0, unit: price, days: product.consumption_days || null }, ...product.combo_pricing.map(c => ({
                qty: c.qty, price: c.price, label: `${c.qty} un.`, off: c.discount_pct || 0, unit: (c.price / c.qty), days: c.days || null,
              }))].map((opt, idx) => {
                const active = qty === opt.qty;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQty(Math.min(product.stock, opt.qty))}
                    className={`text-left rounded-lg border-2 px-3 py-2.5 transition ${active ? 'border-brand-main bg-brand-light/60' : 'border-border hover:border-brand-main/40'}`}
                    data-testid={`combo-opt-${opt.qty}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-txt-primary">
                        {opt.label}
                        {opt.days ? <span className="ml-1 text-xs text-txt-secondary font-normal">({opt.days} dias)</span> : null}
                      </div>
                      {opt.off > 0 && <Badge variant="danger" className="text-[10px]">-{opt.off}%</Badge>}
                    </div>
                    <div className="text-xs text-txt-secondary mt-0.5">{formatCurrency(opt.unit)} / un.</div>
                    <div className="text-sm font-heading font-black text-brand-main">{formatCurrency(opt.price)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Iter 42i: feedback de frete gratis baseado no subtotal hipotetico (carrinho atual + este produto) */}
          {(() => {
            const hypoSubtotal = (cart?.subtotal || 0) + (price * qty);
            const fs = evaluateFreeShipping(settings, user, hypoSubtotal);
            if (!fs.applies && (!fs.threshold || fs.threshold <= 0)) return null;
            return (
              <div className="mt-3" data-testid="product-free-shipping-feedback">
                <FreeShippingProgress
                  subtotal={hypoSubtotal}
                  threshold={fs.threshold || 0}
                  remaining={fs.remaining || 0}
                  applies={fs.applies}
                  label={settings?.free_shipping_label || 'Frete grátis'}
                  mini
                />
              </div>
            );
          })()}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={addToCart} loading={adding} disabled={product.stock <= 0} data-testid="add-cart-btn">
              <ShoppingCart className="w-4 h-4" /> Adicionar
            </Button>
            <Button onClick={buyNow} loading={adding} disabled={product.stock <= 0} data-testid="buy-now-btn">
              Comprar agora
            </Button>
          </div>

          {/* Iter 61: Comprar pelo WhatsApp */}
          {settings?.whatsapp?.enabled && settings?.whatsapp?.number && (() => {
            const rawNum = String(settings.whatsapp.number || '').replace(/\D/g, '');
            const publicUrl = typeof window !== 'undefined' ? window.location.href : '';
            const tpl = settings.whatsapp.message_template || 'Olá! Tenho interesse no produto *{product_name}* — R$ {product_price}.\nLink: {product_url}';
            const linePrice = (product.combo_pricing || []).find(c => Number(c.qty) === Number(qty));
            const shownPrice = linePrice ? linePrice.price : (price * qty);
            const msg = tpl
              .replace(/\{product_name\}/g, product.name || '')
              .replace(/\{product_price\}/g, shownPrice.toFixed(2).replace('.', ','))
              .replace(/\{quantity\}/g, String(qty))
              .replace(/\{product_url\}/g, publicUrl);
            const href = `https://wa.me/${rawNum}?text=${encodeURIComponent(msg)}`;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20b358] text-white font-bold rounded-lg py-3 transition"
                data-testid="whatsapp-buy-btn"
              >
                <MessageCircle className="w-5 h-5" /> Comprar pelo WhatsApp
              </a>
            );
          })()}

          {/* Iter 61: campos personalizados (quadros) */}
          {Array.isArray(product.custom_fields) && product.custom_fields.length > 0 && (
            <div className="mt-6 space-y-3" data-testid="product-custom-fields">
              {product.custom_fields.map((cf, i) => (
                <div key={i} className="bg-bg-secondary border border-border rounded-lg p-3">
                  {cf.title && <div className="font-bold text-sm text-txt-primary mb-0.5">{cf.title}</div>}
                  {cf.text && <div className="text-sm text-txt-secondary whitespace-pre-line">{cf.text}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg">
              <Truck className="w-4 h-4 text-brand-main" />
              <div>
                <div className="font-bold text-txt-primary">Entrega rápida</div>
                <div className="text-txt-secondary">Para todo o Brasil</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg">
              <ShieldCheck className="w-4 h-4 text-brand-main" />
              <div>
                <div className="font-bold text-txt-primary">Compra segura</div>
                <div className="text-txt-secondary">100% protegida</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading font-black text-xl text-txt-primary mb-4">Produtos relacionados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map(p => <ProductCard key={p.product_id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
