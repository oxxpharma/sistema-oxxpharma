import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Tag } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useCart } from '../../contexts/CartContext';
import { toast } from 'sonner';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400';

export default function ProductCard({ product }) {
  const { addItem } = useCart();

  const price = product.discount_price || product.price;
  const hasDiscount = product.discount_price && product.discount_price < product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0;
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
          <div className="text-[11px] uppercase tracking-wider text-brand-main font-bold mb-1">{product.brand}</div>
        )}
        <h3 className="text-sm font-semibold text-txt-primary line-clamp-2 min-h-[40px]">{product.name}</h3>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-heading font-black text-txt-primary">{formatCurrency(price)}</span>
          {hasDiscount && <span className="text-xs text-txt-secondary line-through">{formatCurrency(product.price)}</span>}
        </div>
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
