import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import ProductCard from '../../components/store/ProductCard';
import { Search, Loader2 } from 'lucide-react';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/products?search=${encodeURIComponent(q)}&limit=48`);
        setProducts(data.products || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [q]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="search-page">
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-6 h-6 text-brand-main" />
        <h1 className="font-heading font-black text-2xl text-txt-primary">
          Busca por <span className="text-brand-main">"{q}"</span>
        </h1>
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-txt-secondary">Nenhum produto encontrado.</p>
          <Link to="/" className="text-brand-main font-semibold text-sm mt-3 inline-block">Ver todos os produtos</Link>
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
