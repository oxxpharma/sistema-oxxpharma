import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import ProductCard from '../../components/store/ProductCard';
import HeroCarousel from '../../components/store/HeroCarousel';
import DynamicBlocks from '../../components/store/DynamicBlocks';
import { getIcon } from '../../lib/iconLibrary';
import { Loader2, Pill, Baby, Heart, Sparkles, Droplets, Leaf, LayoutGrid } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';

const ICONS = {
  'Medicamentos': Pill,
  'Dermocosmeticos': Droplets,
  'Vitaminas e Suplementos': Leaf,
  'Higiene Pessoal': Sparkles,
  'Infantil': Baby,
  'Bem-estar': Heart,
};

export default function StoreHome() {
  const [params] = useSearchParams();
  const categoryFilter = params.get('categoria');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  // Iter 43.5: layout dinamico do Page Builder
  const [pageLayout, setPageLayout] = useState(null);
  const settings = useSiteSettings();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Tenta carregar layout dinamico para slug=home do tenant atual
        if (!categoryFilter) {
          try {
            const layout = await api.get('/api/pages/home');
            if (layout && Array.isArray(layout.blocks) && layout.blocks.length > 0 && !layout.is_default) {
              setPageLayout(layout);
              setLoading(false);
              return;
            }
          } catch { /* fallback abaixo */ }
        }
        const [cats, prods, feat] = await Promise.all([
          api.get('/api/categories'),
          api.get(`/api/products?limit=24${categoryFilter ? `&category=${encodeURIComponent(categoryFilter)}` : ''}`),
          categoryFilter ? Promise.resolve({ products: [] }) : api.get('/api/products/featured?limit=4'),
        ]);
        setCategories(cats.categories || []);
        setProducts(prods.products || []);
        setFeatured(feat.products || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryFilter]);

  return (
    <div data-testid="store-home">
      {/* Iter 43.5: Se houver layout dinamico publicado, renderiza no lugar do default */}
      {pageLayout && pageLayout.blocks?.length > 0 ? (
        <div className="w-full">
          <DynamicBlocks blocks={pageLayout.blocks} />
        </div>
      ) : (
      <>
      {/* Hero - carrossel multi-slide (com fallback retrocompativel para banner unico) */}
      {!categoryFilter && (() => {
        const slides = (settings?.hero_slides && settings.hero_slides.length > 0)
          ? settings.hero_slides
          : [{
              title: settings?.hero_title,
              subtitle: settings?.hero_subtitle,
              image_url: settings?.hero_image_url,
              cta_label: settings?.hero_cta_label,
              cta_link: settings?.hero_cta_link,
              overlay_opacity: settings?.hero_overlay_opacity ?? 0.4,
            }];
        return (
          <HeroCarousel slides={slides} settings={settings} />
        );
      })()}

      {/* Categorias */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-black text-2xl text-txt-primary">
            {categoryFilter ? `Categoria: ${categoryFilter}` : 'Navegue por categoria'}
          </h2>
          {categoryFilter && (
            <Link to="/" className="text-sm text-brand-main font-semibold">Ver todos os produtos</Link>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3" data-testid="categories-grid">
          {!categoryFilter && (
            <Link
              to="/#produtos"
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border transition-all hover:-translate-y-1 bg-[#FFF9F5] border-orange-100/80 hover:border-brand-main/50 hover:shadow-md"
              data-testid="category-todos"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-orange-100/70 shadow-2xs">
                <LayoutGrid className="w-5 h-5 text-brand-main" />
              </div>
              <span className="text-xs font-bold text-center text-txt-primary">Todos</span>
            </Link>
          )}
          {categories.map(cat => {
            const Icon = (cat.icon && getIcon(cat.icon)) || ICONS[cat.name] || Sparkles;
            const active = categoryFilter === cat.name;
            return (
              <Link
                key={cat.category_id}
                to={`/?categoria=${encodeURIComponent(cat.name)}`}
                className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border transition-all hover:-translate-y-1 ${active ? 'bg-brand-main text-white border-brand-main shadow-md' : 'bg-[#FFF9F5] border-orange-100/80 hover:border-brand-main/50 hover:shadow-md'}`}
                data-testid={`category-${cat.name}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-white/20' : 'bg-white border border-orange-100/70 shadow-2xs'}`}>
                  {cat.icon_svg ? (
                    <img src={cat.icon_svg} alt={cat.name} className="w-6 h-6 object-contain" />
                  ) : (
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-brand-main'}`} />
                  )}
                </div>
                <span className={`text-xs font-bold text-center ${active ? 'text-white' : 'text-txt-primary'}`}>{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Destaques */}
      {!categoryFilter && featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h2 className="font-heading font-black text-2xl text-txt-primary mb-6">Ofertas em destaque</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="featured-grid">
            {featured.map(p => <ProductCard key={p.product_id} product={p} />)}
          </div>
        </section>
      )}

      {/* Todos produtos */}
      <section id="produtos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-heading font-black text-2xl text-txt-primary mb-6">
          {categoryFilter ? 'Produtos' : 'Todos os produtos'}
        </h2>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-txt-secondary">Nenhum produto disponível.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="products-grid">
            {products.map(p => <ProductCard key={p.product_id} product={p} />)}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
}
