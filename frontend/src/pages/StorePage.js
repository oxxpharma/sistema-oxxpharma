import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const LOGO_URL = 'https://customer-assets.emergentagent.com/job_oxx-franchise-system/artifacts/5hmh2yiu_image.png';
const PLACEHOLDER_IMG = 'https://static.prod-images.emergentagent.com/jobs/ac7e11bd-2d3b-4351-a0cb-75f5d21dc8a6/images/6815fa61cc87672743238a27b5dfa9219f796815878c776f3f29d10b600f2040.png';

export default function StorePage() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = searchParams.get('ref');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products?active=true`);
      if (res.ok) { const d = await res.json(); setProducts(d.products); }
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg-secondary font-body">
      <nav className="bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="OxxPharma" className="h-7" />
            <span className="font-heading font-bold text-lg text-txt-primary tracking-tight">OxxPharma</span>
          </div>
          <Link to="/login" className="px-4 py-2 bg-brand-main text-white text-sm font-semibold rounded-md hover:bg-brand-hover">
            Entrar
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="font-heading font-bold text-2xl text-txt-primary tracking-tight">Nossos Produtos</h1>
        {ref && <p className="text-sm text-brand-main mt-1">Indicacao: {ref}</p>}

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 mx-auto text-border mb-3" />
            <p className="text-txt-secondary">Nenhum produto disponivel</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {products.map(p => (
              <div key={p.product_id} className="bg-white border border-border rounded-md overflow-hidden hover:-translate-y-0.5 hover:shadow-sm transition-all">
                <div className="h-44 bg-bg-secondary flex items-center justify-center overflow-hidden">
                  <img src={p.images?.[0] || PLACEHOLDER_IMG} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <h3 className="font-heading font-semibold text-sm text-txt-primary">{p.name}</h3>
                  <p className="text-xs text-txt-secondary mt-1 line-clamp-2">{p.description}</p>
                  <div className="mt-3">
                    <span className="text-lg font-heading font-bold text-brand-main">{formatCurrency(p.discount_price || p.price)}</span>
                    {p.discount_price && <span className="text-xs text-txt-secondary line-through ml-2">{formatCurrency(p.price)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
