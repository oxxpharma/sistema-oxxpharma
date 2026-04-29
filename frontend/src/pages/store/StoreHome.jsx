import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import ProductCard from '../../components/store/ProductCard';
import { Loader2, ArrowRight, Pill, Baby, Heart, Sparkles, Droplets, Leaf } from 'lucide-react';
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
  const settings = useSiteSettings();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
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
      {/* Hero */}
      {!categoryFilter && (
        <section
          className="relative text-white"
          style={settings?.hero_image_url
            ? { backgroundImage: `url(${settings.hero_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : {}}
        >
          {settings?.hero_image_url
            ? <div className="absolute inset-0 bg-black" style={{ opacity: settings?.hero_overlay_opacity ?? 0.4 }} />
            : <div className="absolute inset-0 bg-gradient-to-br from-brand-main via-brand-hover to-orange-700" />}
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid md:grid-cols-2 gap-8 items-center">
            <div className="fade-in">
              <div className="inline-block bg-white/15 backdrop-blur text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                {settings?.tagline || 'Frete para todo o Brasil'}
              </div>
              <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl leading-tight">
                {settings?.hero_title || 'Saúde e bem-estar na sua porta.'}
              </h1>
              <p className="mt-4 text-white/90 text-base max-w-md">
                {settings?.hero_subtitle || 'Medicamentos, vitaminas, dermocosméticos e mais — com atendimento e preços que cuidam de você.'}
              </p>
              <div className="mt-8 flex gap-3">
                <Link to={settings?.hero_cta_link || '#produtos'} className="inline-flex items-center gap-2 bg-white text-brand-main px-6 py-3 rounded-lg font-bold hover:bg-white/90 transition" data-testid="hero-cta">
                  {settings?.hero_cta_label || 'Ver produtos'} <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/indique-ganhe" className="inline-flex items-center gap-2 border-2 border-white/40 px-6 py-3 rounded-lg font-bold hover:bg-white/10 transition">
                  Indique e ganhe
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              {!settings?.hero_image_url && (
                <div className="aspect-square max-w-md ml-auto rounded-3xl bg-white/10 backdrop-blur border border-white/20 p-8 relative overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600" alt="" className="w-full h-full object-cover rounded-2xl" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
          {categories.map(cat => {
            const Icon = ICONS[cat.name] || Sparkles;
            const active = categoryFilter === cat.name;
            return (
              <Link
                key={cat.category_id}
                to={`/?categoria=${encodeURIComponent(cat.name)}`}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all hover:-translate-y-0.5 ${active ? 'bg-brand-main text-white border-brand-main' : 'bg-white border-border hover:border-brand-main/40 hover:shadow-md'}`}
                data-testid={`category-${cat.name}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-white/15' : 'bg-brand-light'}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-brand-main'}`} />
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
    </div>
  );
}
