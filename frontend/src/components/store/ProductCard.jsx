import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Tag, Award } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { canSeeProductPoints, formatPointsLabel } from '../../lib/pointsVisibility';
import { toast } from 'sonner';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const settings = useSiteSettings();

  // Backend ja calcula effective_price baseado em pricing_tiers do usuario.
  // Fallback para produtos antigos sem o campo decorado.
  const tierApplied = product.tier_applied;
  const effective = (typeof product.effective_price === 'number') ? product.effective_price : (product.discount_price || product.price);
  const original = (typeof product.original_price === 'number' && product.original_price > 0) ? product.original_price : (product.discount_price || product.price);
  const hasDiscount = effective < (product.price || 0);
  const discountPct = hasDiscount && product.price ? Math.round((1 - effective / product.price) * 100) : 0;
  const img = (product.images && product.images[0]) || PLACEHOLDER;

  const onAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await addItem(product.product_id, 1);
      toast.success('Produto adicionado ao carrinho');
    } catch (err) {
      toast.error(err.message || 'Erro ao adicionar');
    }
  };

  return (
    <Link
      to={`/produto/${product.product_id}`}
      className="group bg-white rounded-xl border border-border hover:shadow-lg hover:border-brand-main/30 transition-all duration-200 flex flex-col overflow-hidden"
      data-testid={`product-card-${product.product_id}`}
    >
      <div className="relative aspect-square bg-bg-secondary overflow-hidden">
        <img
          src={img}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { e.target.src = PLACEHOLDER; }}
        />
        {hasDiscount && (
          <div className="absolute top-2 left-2 bg-brand-main text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
            <Tag className="w-3 h-3" />-{discountPct}%
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        {product.brand && (
          <div
            className="uppercase tracking-wider text-brand-main font-bold mb-1"
            style={{ fontSize: `${settings?.product_card_brand_px || 11}px` }}
          >
            {product.brand}
          </div>
        )}
        <h3
          className="font-semibold text-txt-primary line-clamp-2 min-h-[40px]"
          style={{ fontSize: `${settings?.product_card_title_px || 14}px`, lineHeight: 1.25 }}
        >
          {product.name}
        </h3>
        {tierApplied && (
          <div
            className="mt-1 inline-block self-start uppercase tracking-wider bg-brand-light text-brand-main rounded-full px-2 py-0.5 font-bold"
            style={{ fontSize: `${settings?.product_card_label_px || 10}px` }}
          >
            {/* Iter 42k: para tier=guest, label global em site_settings tem precedencia */}
            {tierApplied.type === 'guest' && (settings?.guest_tier_label_global || '').trim()
              ? settings.guest_tier_label_global.trim()
              : (tierApplied.label || 'Preço especial')}
          </div>
        )}
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className="font-heading font-black text-txt-primary"
            style={{ fontSize: `${settings?.product_card_price_px || 18}px` }}
          >
            {formatCurrency(effective)}
          </span>
          {hasDiscount && (
            <span
              className="text-txt-secondary line-through"
              style={{ fontSize: `${settings?.product_card_strike_px || 12}px` }}
            >
              {formatCurrency(product.price)}
            </span>
          )}
          {!hasDiscount && tierApplied && original > effective && (
            <span
              className="text-txt-secondary line-through"
              style={{ fontSize: `${settings?.product_card_strike_px || 12}px` }}
            >
              {formatCurrency(original)}
            </span>
          )}
        </div>
        {/* Iter 39: preco do clube de beneficios visivel para todos */}
        {typeof product.club_price === 'number' && product.club_price > 0 && product.club_price < effective && (
          <div
            className="mt-1 leading-tight"
            style={{ fontSize: `${settings?.product_card_label_px || 12}px` }}
            data-testid={`product-club-price-${product.product_id}`}
          >
            <span className="text-txt-secondary">Preço para participante do </span>
            <span className="font-semibold text-emerald-700">Clube do Benefícios</span>
            <span className="text-txt-secondary">: </span>
            <span className="font-bold text-emerald-700">{formatCurrency(product.club_price)}</span>
          </div>
        )}
        {canSeeProductPoints(user, settings) && product.points_value > 0 && (
          <div
            className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-700"
            style={{ fontSize: `${settings?.product_card_label_px || 12}px` }}
            data-testid={`product-points-${product.product_id}`}
          >
            <Award className="w-3 h-3" />
            Ganhe {formatPointsLabel(product.points_value, settings?.points_visibility_label || 'pontos')}
          </div>
        )}
        <button
          onClick={onAdd}
          className="mt-3 w-full h-10 rounded-lg bg-brand-main hover:bg-brand-hover text-white text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98]"
          data-testid={`add-to-cart-${product.product_id}`}
        >
          <ShoppingCart className="w-4 h-4" /> Adicionar
        </button>
      </div>
    </Link>
  );
}
