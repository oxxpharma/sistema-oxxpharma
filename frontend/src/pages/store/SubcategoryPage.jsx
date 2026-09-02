import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import ProductCard from '../../components/store/ProductCard';
import SEOHead from '../../components/SEOHead';
import { Loader2, ChevronRight } from 'lucide-react';

/**
 * Iter 62 (SEO): Pagina publica de Subcategoria — /subcategoria/:slug
 */
export default function SubcategoryPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api.get(`/api/subcategories/by-slug/${slug}`)
      .then(d => { if (alive) setData(d); })
      .catch(err => { if (alive) setError(err.message || 'Subcategoria nao encontrada'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  if (loading) return <div className="max-w-6xl mx-auto p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-10 text-center">
        <p className="text-txt-secondary">{error || 'Subcategoria não encontrada.'}</p>
        <button onClick={() => nav('/')} className="mt-4 text-brand-main underline">Voltar ao início</button>
      </div>
    );
  }

  const sc = data.subcategory;
  const parents = data.parents || [];
  const products = data.products || [];
  const title = sc.seo_title || `${sc.name}${parents[0] ? ` - ${parents[0].name}` : ''} | OxxPharma`;
  const description = sc.seo_description || sc.description || `Confira produtos da subcategoria ${sc.name}${parents[0] ? ` em ${parents[0].name}` : ''} na OxxPharma.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": sc.name,
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
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10" data-testid="subcategory-page">
      <SEOHead title={title} description={description} canonical={`/subcategoria/${sc.slug}`} jsonLd={jsonLd} />

      <nav className="text-xs text-txt-secondary mb-4 flex items-center gap-1 flex-wrap" aria-label="Trilha">
        <Link to="/" className="hover:text-brand-main">Início</Link>
        {parents[0] && parents[0].slug && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/categoria/${parents[0].slug}`} className="hover:text-brand-main">{parents[0].name}</Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-txt-primary font-semibold">{sc.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-heading font-black text-3xl md:text-4xl text-txt-primary">{sc.name}</h1>
        {sc.description && <p className="text-sm md:text-base text-txt-secondary mt-2 max-w-3xl">{sc.description}</p>}
      </header>

      <section aria-label="Produtos">
        <h2 className="font-heading font-bold text-lg mb-3">
          {products.length} produto{products.length !== 1 ? 's' : ''}
        </h2>
        {products.length === 0 ? (
          <div className="p-10 text-center text-txt-secondary bg-bg-secondary rounded-xl">
            Ainda não há produtos nesta subcategoria.
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
