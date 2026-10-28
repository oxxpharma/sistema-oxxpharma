import React from 'react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { getIcon } from '../../lib/iconLibrary';

const DEFAULT_BENEFITS = [
  { icon: 'Truck', title: 'Frete grátis', desc: 'Em compras acima de R$ 500,00' },
  { icon: 'DollarSign', title: 'Desconto no Pix', desc: '3% Off' },
  { icon: 'CreditCard', title: 'Parcelamento', desc: 'em até 6x sem juros' },
];

export default function TrustBar({ items, use_store_settings = true, variant = 'horizontal', className = '' }) {
  const settings = useSiteSettings();

  // Se use_store_settings for true (ou items não fornecido), usa os trust_items da loja
  let resolvedItems = DEFAULT_BENEFITS;
  if (!use_store_settings && Array.isArray(items) && items.length > 0) {
    resolvedItems = items;
  } else if (Array.isArray(settings?.trust_items) && settings.trust_items.length > 0) {
    resolvedItems = settings.trust_items;
  } else if (Array.isArray(items) && items.length > 0) {
    resolvedItems = items;
  }

  if (!resolvedItems || resolvedItems.length === 0) return null;

  // Variante Compacta (Página de Detalhes do Produto)
  if (variant === 'compact') {
    return (
      <div
        className={`mt-6 pt-5 border-t border-border space-y-3 ${className}`}
        data-testid="product-trust-bar"
      >
        {resolvedItems.slice(0, 4).map((it, idx) => {
          const Icon = getIcon(it.icon);
          return (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50/80 border border-orange-100/70 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-brand-main" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-txt-primary">{it.title}</div>
                <div className="text-[11px] text-txt-secondary leading-snug">{it.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Variante Horizontal (PageBuilder / Seção da Home)
  return (
    <div
      className={`w-full bg-white border-y border-border py-8 ${className}`}
      data-testid="trust-benefits-bar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
          {resolvedItems.map((it, idx) => {
            const Icon = getIcon(it.icon);
            return (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-brand-main" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-txt-primary">{it.title}</div>
                  <div className="text-xs text-txt-secondary mt-0.5">{it.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
