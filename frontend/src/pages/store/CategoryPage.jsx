import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import ProductCard from '../../components/store/ProductCard';
import SEOHead from '../../components/SEOHead';
import { Loader2, ChevronRight } from 'lucide-react';

/**
 * Iter 62 (SEO): Pagina publica de Categoria — /categoria/:slug
 * Indexavel: title/description/canonical/OG + JSON-LD ItemList.
 */
export default function CategoryPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api.get(`/api/categories/by-slug/${slug}`)
      .then(d => { if (alive) setData(d); })
      .catch(err => { if (alive) setError(err.message || 'Categoria nao encontrada'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  if (loading) return <div className="max-w-6xl mx-auto p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-10 text-center">
        <p className="text-txt-secondary">{error || 'Categoria não encontrada.'}</p>
        <button onClick={() => nav('/')} className="mt-4 text-brand-main underline">Voltar ao início</button>
      </div>
    );
  }

  const cat = data.category;
  const subs = data.subcategories || [];
  const products = data.products || [];
  const title = cat.seo_title || `${cat.name} | OxxPharma`;
  const description = cat.seo_description || cat.description || `Confira todos os produtos da categoria ${cat.name} na OxxPharma. Entrega rápida e melhores preços.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": cat.name,
    "description": description,
    "url": (typeof window !== 'undefined') ? window.location.href : undefined,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": products.length,
      "itemListElement": products.slice(0, 40).map((p, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": `${window.location.origin}/produto/${p.product_id}`,
        "name": p.name,
      })),
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10" data-testid="category-page">
      <SEOHead
        title={title}
        description={description}
        canonical={`/categoria/${cat.slug}`}
        image={cat.image_url || undefined}
        type="website"
        jsonLd={jsonLd}
      />

      <nav className="text-xs text-txt-secondary mb-4 flex items-center gap-1" aria-label="Trilha">
        <Link to="/" className="hover:text-brand-main">Início</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-txt-primary font-semibold">{cat.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-heading font-black text-3xl md:text-4xl text-txt-primary">{cat.name}</h1>
        {cat.description && <p className="text-sm md:text-base text-txt-secondary mt-2 max-w-3xl">{cat.description}</p>}
      </header>

      {subs.length > 0 && (
        <section className="mb-8" aria-label="Subcategorias">
          <h2 className="font-heading font-bold text-lg mb-3">Subcategorias</h2>
          <div className="flex flex-wrap gap-2">
            {subs.map(sc => (
              <Link
                key={sc.subcategory_id}
                to={`/subcategoria/${sc.slug || sc.subcategory_id}`}
                className="px-3 py-1.5 border border-border rounded-full text-sm hover:border-brand-main hover:bg-brand-light/40 transition"
                data-testid={`subcat-link-${sc.slug || sc.subcategory_id}`}
              >
                {sc.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Produtos">
        <h2 className="font-heading font-bold text-lg mb-3">
          {products.length} produto{products.length !== 1 ? 's' : ''}
        </h2>
        {products.length === 0 ? (
          <div className="p-10 text-center text-txt-secondary bg-bg-secondary rounded-xl">
            Ainda não há produtos nesta categoria.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map(p => <ProductCard key={p.product_id} product={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
