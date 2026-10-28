import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
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
import { ShoppingCart, Minus, Plus, Loader2, ArrowLeft, Award, Check, MessageCircle, Star, X } from 'lucide-react';
import { toast } from 'sonner';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreviewParam = searchParams.get('preview') === 'true' || searchParams.get('preview') === '1';
  const { addItem, cart } = useCart();
  const { user } = useAuth();
  const settings = useSiteSettings();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  // Scroll de imagens e vertical sticky centering
  const containerRef = useRef(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reviews
  const [reviewsData, setReviewsData] = useState({ reviews: [], average: 5, count: 0 });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: '',
    user_name: user?.name || '',
    user_email: user?.email || '',
  });

  const images = (product?.images && product.images.length > 0) ? product.images : [PLACEHOLDER];

  // Carrega reviews aprovadas
  useEffect(() => {
    if (id) {
      api.get(`/api/products/${id}/reviews`)
        .then(data => setReviewsData(data))
        .catch(() => {});
    }
  }, [id]);

  // Scroll tracking para troca automatica de fotos quando houver mais de 1 foto
  useEffect(() => {
    if (images.length <= 1) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerTop = rect.top;
      const containerHeight = rect.height;
      const viewportHeight = window.innerHeight;

      // Distancia de scroll dentro do card de detalhes do produto
      const scrollableDist = containerHeight - (viewportHeight * 0.5);
      if (scrollableDist <= 0) return;

      const scrolled = -containerTop + (viewportHeight * 0.2);
      const progress = Math.min(Math.max(scrolled / scrollableDist, 0), 0.999);
      const targetIndex = Math.floor(progress * images.length);

      setActiveImageIndex(targetIndex);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [images.length]);

  const handleSendReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.comment.trim() || !reviewForm.user_name.trim()) {
      toast.error('Preencha seu nome e seu comentário');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await api.post(`/api/products/${product.product_id}/reviews`, {
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        user_name: reviewForm.user_name.trim(),
        user_email: reviewForm.user_email || (user?.email || ''),
      });
      toast.success(res.message || 'Avaliação enviada com sucesso! Ficará visível após moderação.');
      setShowReviewModal(false);
      setReviewForm({ rating: 5, comment: '', user_name: user?.name || '', user_email: user?.email || '' });
    } catch (err) {
      toast.error(err.message || 'Erro ao enviar avaliação');
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const query = isPreviewParam ? '?preview=true' : '';
        const data = await api.get(`/api/products/${id}${query}`);
        setProduct(data.product);
        setRelated(data.related || []);
      } catch (err) {
        toast.error('Produto não encontrado ou indisponível');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isPreviewParam]);

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
        title={product.seo_title || `${product.name}${product.brand ? ' - ' + product.brand : ''} | OxxPharma`}
        description={product.seo_description || (product.description || product.name || '').slice(0, 160)}
        keywords={product.seo_keywords}
        canonical={product.canonical_url || `/produto/${product.slug || product.product_id}`}
        image={img}
        type="product"
        noindex={!product.active || isPreviewParam}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.name,
          "description": (product.seo_description || product.description || '').slice(0, 500),
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

      {(!product.active || isPreviewParam) && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-center justify-between gap-4 flex-wrap shadow-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 font-bold text-xs uppercase tracking-wider">
              Modo de Pré-visualização
            </span>
            <div className="text-sm">
              {!product.active ? (
                <>
                  <span className="font-semibold text-amber-900">Produto Inativo:</span> Este produto está desativado e <strong>não é exibido na loja pública</strong> nem na página principal.
                </>
              ) : (
                <>
                  <span className="font-semibold text-amber-900">Pré-visualização:</span> Visualizando como administrador (produto ativo na loja).
                </>
              )}
            </div>
          </div>
          <Link
            to={`/backoffice/produtos/${product.product_id}`}
            className="text-xs font-semibold px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-amber-900 transition-colors shadow-xs"
          >
            Editar no Admin
          </Link>
        </div>
      )}

      <div ref={containerRef} className="grid md:grid-cols-2 gap-8 rounded-xl border-border p-4 md:p-8 items-start">
        <div
          className="rounded-2xl overflow-hidden md:sticky md:self-start transition-all"
          style={{ top: 'max(96px, calc(50vh - 240px))' }}
          data-testid="product-image-wrap"
        >
          <div className="relative aspect-square flex items-center justify-center bg-gray-50/50 rounded-2xl overflow-hidden">
            {images.map((im, idx) => (
              <img
                key={idx}
                src={im}
                alt={product.name}
                className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ease-in-out ${
                  idx === activeImageIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onError={(e) => { e.target.src = PLACEHOLDER; }}
              />
            ))}
          </div>

          {/* Indicadores / Paginação de fotos quando houver mais de 1 foto */}
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {images.map((im, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    idx === activeImageIndex
                      ? 'w-7 bg-brand-main shadow-xs'
                      : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  title={`Foto ${idx + 1}`}
                />
              ))}
            </div>
          )}
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
            <Button
              variant="outline"
              onClick={addToCart}
              loading={adding}
              disabled={!product.active || product.stock <= 0}
              data-testid="add-cart-btn"
            >
              <ShoppingCart className="w-4 h-4" /> {!product.active ? 'Produto inativo' : 'Adicionar'}
            </Button>
            <Button
              onClick={buyNow}
              loading={adding}
              disabled={!product.active || product.stock <= 0}
              data-testid="buy-now-btn"
            >
              {!product.active ? 'Indisponível (Inativo)' : 'Comprar agora'}
            </Button>
          </div>

          {/* Iter 61: Comprar pelo WhatsApp */}
          {product.active && settings?.whatsapp?.enabled && settings?.whatsapp?.number && (() => {
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

          
        </div>
      </div>

            {/* SEÇÃO DE REVIEWS (Avaliações dos Clientes) */}
      <section className="mt-12 bg-white rounded-2xl border border-border p-6 md:p-8 shadow-xs" data-testid="product-reviews-section">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="font-heading font-black text-2xl text-txt-primary flex items-center gap-2.5">
              Reviews
              {reviewsData.count > 0 && (
                <span className="text-xs font-semibold text-txt-secondary bg-gray-100 px-2.5 py-0.5 rounded-full">
                  {reviewsData.count}
                </span>
              )}
            </h2>
            {reviewsData.count > 0 ? (
              <div className="flex items-center gap-2.5 mt-1.5">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(reviewsData.average)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-sm text-txt-primary">{reviewsData.average.toFixed(1)}</span>
                <span className="text-xs text-txt-secondary">com base em {reviewsData.count} avaliação{reviewsData.count > 1 ? 'ões' : ''}</span>
              </div>
            ) : (
              <p className="text-xs text-txt-secondary mt-1">Este produto ainda não possui avaliações públicas.</p>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => setShowReviewModal(true)}
            className="gap-2 text-xs h-9"
            data-testid="leave-review-btn"
          >
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Deixar uma avaliação
          </Button>
        </div>

        {reviewsData.reviews.length === 0 ? (
          <div className="text-center py-10 bg-gray-50/70 rounded-xl border border-dashed border-gray-200">
            <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-txt-secondary font-medium">Ainda não há avaliações publicadas para este produto.</p>
            <p className="text-xs text-gray-400 mt-0.5">Seja o primeiro a avaliar após receber seu pedido!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviewsData.reviews.map((rev) => (
              <div
                key={rev.review_id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-gray-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-gray-900">{rev.user_name}</span>
                    <span className="text-xs text-gray-400">{formatDate(rev.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed italic">
                    "{rev.comment}"
                  </p>
                </div>
                {rev.verified_purchase && (
                  <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Compra verificada
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Deixar Avaliação */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="font-heading font-black text-lg text-txt-primary flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                Avaliar {product?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
                  Sua Nota (1 a 5 estrelas)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewForm({ ...reviewForm, rating: s })}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          s <= reviewForm.rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-amber-600">
                    {reviewForm.rating}/5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Seu Nome*
                </label>
                <input
                  type="text"
                  required
                  value={reviewForm.user_name}
                  onChange={(e) => setReviewForm({ ...reviewForm, user_name: e.target.value })}
                  placeholder="Seu nome ou apelido"
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Seu Depoimento sobre o Produto*
                </label>
                <textarea
                  rows={4}
                  required
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  placeholder="Conte o que achou da fórmula, benefícios notados, sabor, facilidade de uso, etc..."
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowReviewModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" loading={submittingReview}>
                  Enviar Avaliação
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
