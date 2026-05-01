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
import { ShoppingCart, Truck, ShieldCheck, Minus, Plus, Loader2, ArrowLeft, Award } from 'lucide-react';
import { toast } from 'sonner';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
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
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-brand-main mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="grid md:grid-cols-2 gap-8 bg-white rounded-xl border border-border p-4 md:p-8">
        <div className="bg-bg-secondary rounded-xl overflow-hidden aspect-square">
          <img src={img} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = PLACEHOLDER; }} />
        </div>

        <div>
          {product.brand && <Badge variant="brand" className="mb-2">{product.brand}</Badge>}
          <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary" data-testid="product-name">{product.name}</h1>
          <p className="text-sm text-txt-secondary mt-3 leading-relaxed">{product.description}</p>

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

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={addToCart} loading={adding} disabled={product.stock <= 0} data-testid="add-cart-btn">
              <ShoppingCart className="w-4 h-4" /> Adicionar
            </Button>
            <Button onClick={buyNow} loading={adding} disabled={product.stock <= 0} data-testid="buy-now-btn">
              Comprar agora
            </Button>
          </div>

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
