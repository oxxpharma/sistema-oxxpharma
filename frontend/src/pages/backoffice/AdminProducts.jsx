import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Plus, Edit, Trash2, Search, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../../components/admin/Pagination';

const PAGE_LIMIT = 20;

export default function AdminProducts() {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (targetPage) => {
    setLoading(true);
    const tp = typeof targetPage === 'number' ? targetPage : 1;
    try {
      const q = new URLSearchParams({ page: String(tp), limit: String(PAGE_LIMIT) });
      if (search) q.set('search', search);
      const p = await api.get(`/api/admin/products?${q}`);
      setProducts(p.products || []);
      setPages(p.pages || 1);
      setTotal(p.total || 0);
      setPage(p.page || tp);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, [load]);

  const del = async (id) => {
    if (!window.confirm('Excluir produto?')) return;
    try { await api.del(`/api/admin/products/${id}`); toast.success('Produto excluído'); load(page); } catch (err) { toast.error(err.message); }
  };

  return (
    <div data-testid="admin-products">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary">Produtos</h1>
        <Button onClick={() => nav('/backoffice/produtos/novo')} data-testid="new-product-btn"><Plus className="w-4 h-4" /> Novo produto</Button>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, descrição ou marca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/20"
            data-testid="product-search"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-left p-3">Categoria</th>
                  <th className="text-right p-3">Preço</th>
                  <th className="text-right p-3">Estoque</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.product_id} className="border-t border-border hover:bg-bg-secondary/50" data-testid={`product-row-${p.product_id}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-bg-secondary overflow-hidden flex-shrink-0">
                          {(p.images || [])[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-gray-400 m-auto mt-2.5" />}
                        </div>
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          {p.brand && <div className="text-xs text-txt-secondary">{p.brand}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-txt-secondary">{p.category}</td>
                    <td className="p-3 text-right">
                      {p.discount_price ? <><span className="font-bold">{formatCurrency(p.discount_price)}</span><div className="text-xs line-through text-txt-secondary">{formatCurrency(p.price)}</div></> : <span className="font-bold">{formatCurrency(p.price)}</span>}
                    </td>
                    <td className="p-3 text-right">{p.stock}</td>
                    <td className="p-3 text-center space-x-1">
                      {p.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="error">Inativo</Badge>}
                      {p.featured && <Badge variant="brand">Destaque</Badge>}
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => nav(`/backoffice/produtos/${p.product_id}`)} className="p-2 hover:bg-bg-secondary rounded" data-testid={`edit-${p.product_id}`}><Edit className="w-4 h-4" /></button>
                      <button onClick={() => del(p.product_id)} className="p-2 hover:bg-red-50 text-red-500 rounded" data-testid={`del-${p.product_id}`}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-txt-secondary">Nenhum produto cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} pages={pages} total={total} limit={PAGE_LIMIT} onChange={(p) => load(p)} testId="products-pagination" />
          </div>
        </div>
      )}
    </div>
  );
}
