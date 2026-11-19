import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import ProductCard from '../../components/store/ProductCard';
import { Search, Loader2, Sparkles, ArrowRight } from 'lucide-react';

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') || params.get('search') || '';
  const categoria = params.get('categoria') || params.get('category') || '';
  const [products, setProducts] = useState([]);
  const [didYouMean, setDidYouMean] = useState(null);
  const [loading, setLoading] = useState(true);

  // Redireciona links canônicos de categoria acessados via /produtos?categoria=XYZ
  useEffect(() => {
    if (categoria && !q) {
      navigate(`/categoria/${categoria}`, { replace: true });
    }
  }, [categoria, q, navigate]);

  useEffect(() => {
    if (categoria && !q) return;

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (q) queryParams.set('search', q);
        if (categoria) queryParams.set('category', categoria);
        queryParams.set('limit', '48');

        const data = await api.get(`/api/products?${queryParams.toString()}`);
        if (!alive) return;
        setProducts(data.products || []);
        setDidYouMean(data.did_you_mean || null);
      } catch (err) {
        console.error('Falha ao carregar busca:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [q, categoria]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="search-page">
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-6 h-6 text-brand-main" />
        <h1 className="font-heading font-black text-2xl text-txt-primary">
          {q ? (
            <>Busca por <span className="text-brand-main">"{q}"</span></>
          ) : (
            <>Catálogo de Produtos</>
          )}
        </h1>
      </div>

      {/* Sugestão Você Quis Dizer (Typo Tolerance / Busca Inteligente) */}
      {didYouMean && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl text-sm text-gray-800 flex items-center justify-between flex-wrap gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-brand-main shrink-0" />
            <span>
              Você quis dizer: <strong className="text-brand-main font-bold">{didYouMean}</strong>? Exibindo resultados aproximados.
            </span>
          </div>
          <Link
            to={`/buscar?q=${encodeURIComponent(didYouMean)}`}
            className="text-xs font-bold text-brand-main hover:underline whitespace-nowrap bg-white px-3.5 py-1.5 rounded-xl border border-orange-200 hover:bg-orange-100/50 shadow-xs flex items-center gap-1.5 transition"
          >
            <span>Ver apenas "{didYouMean}"</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 p-8 shadow-xs">
          <p className="text-txt-secondary text-base font-medium">Nenhum produto encontrado para sua busca.</p>
          <p className="text-xs text-gray-400 mt-1">Tente palavras diferentes, termos mais gerais ou verifique a ortografia.</p>
          <Link to="/" className="text-brand-main font-semibold text-sm mt-4 inline-block hover:underline">
            Voltar para o início &rarr;
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-txt-secondary mb-4">{products.length} produto(s) encontrado(s)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => <ProductCard key={p.product_id} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
