import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { Plus, Edit2, Trash2, X, Search, Package } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const PLACEHOLDER_IMG = 'https://static.prod-images.emergentagent.com/jobs/ac7e11bd-2d3b-4351-a0cb-75f5d21dc8a6/images/6815fa61cc87672743238a27b5dfa9219f796815878c776f3f29d10b600f2040.png';

export default function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', price: '', discount_price: '',
    category: '', stock: '', images: [], active: true,
  });

  useEffect(() => { fetchProducts(); }, [page, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/products?page=${page}&limit=12&active=`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setProducts(d.products); setTotal(d.total); }
    } catch {} finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditProd(null);
    setForm({ name: '', description: '', price: '', discount_price: '', category: '', stock: '', images: [], active: true });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProd(p);
    setForm({
      name: p.name, description: p.description, price: p.price, discount_price: p.discount_price || '',
      category: p.category, stock: p.stock, images: p.images || [], active: p.active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = {
      ...form,
      price: parseFloat(form.price) || 0,
      discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
      stock: parseInt(form.stock) || 0,
    };
    try {
      if (editProd) {
        await fetch(`${API_URL}/api/products/${editProd.product_id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`${API_URL}/api/products`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setShowModal(false);
      fetchProducts();
    } catch {}
  };

  const handleDelete = async (pid) => {
    if (!window.confirm('Excluir este produto?')) return;
    await fetch(`${API_URL}/api/products/${pid}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    fetchProducts();
  };

  return (
    <AppLayout title="Produtos" subtitle={`${total} produtos`}>
      <div className="space-y-4 fade-in">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-secondary" />
            <input
              type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar produtos..."
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-main"
              data-testid="products-search"
            />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-brand-main text-white rounded-md text-sm font-semibold hover:bg-brand-hover" data-testid="create-product-btn">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" /></div>
        ) : products.length === 0 ? (
          <DashCard>
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-border mb-3" />
              <p className="text-txt-secondary">Nenhum produto cadastrado</p>
            </div>
          </DashCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(p => (
              <div key={p.product_id} className="bg-white border border-border rounded-md overflow-hidden hover:-translate-y-0.5 hover:shadow-sm transition-all" data-testid={`product-card-${p.product_id}`}>
                <div className="h-40 bg-bg-secondary flex items-center justify-center overflow-hidden">
                  <img src={p.images?.[0] || PLACEHOLDER_IMG} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-heading font-semibold text-sm text-txt-primary">{p.name}</h4>
                      <p className="text-xs text-txt-secondary mt-0.5">{p.category}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-heading font-bold text-brand-main">{formatCurrency(p.price)}</span>
                    {p.discount_price && (
                      <span className="text-xs text-txt-secondary line-through">{formatCurrency(p.discount_price)}</span>
                    )}
                  </div>
                  <p className="text-xs text-txt-secondary mt-1">Estoque: {p.stock}</p>
                  <div className="flex gap-1 mt-3 pt-3 border-t border-border">
                    <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-brand-main hover:bg-brand-light rounded-md" data-testid={`edit-product-${p.product_id}`}>
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button onClick={() => handleDelete(p.product_id)} className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-accent-red hover:bg-red-50 rounded-md" data-testid={`delete-product-${p.product_id}`}>
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" data-testid="product-modal">
            <div className="bg-white rounded-md border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h3 className="font-heading font-bold text-lg">{editProd ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-bg-secondary rounded-md"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">Nome</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="product-form-name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">Descricao</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                    rows={3} className="w-full px-3 py-2 border border-border rounded-md text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Preco (R$)</label>
                    <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="product-form-price" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Preco Desconto</label>
                    <input type="number" value={form.discount_price} onChange={e => setForm({...form, discount_price: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Categoria</label>
                    <input value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="product-form-category" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-txt-secondary mb-1">Estoque</label>
                    <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm" data-testid="product-form-stock" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})}
                    className="rounded border-border" id="active-check" />
                  <label htmlFor="active-check" className="text-sm text-txt-primary">Produto ativo</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-5 py-3.5 border-t border-border">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-txt-secondary hover:bg-bg-secondary rounded-md">Cancelar</button>
                <button onClick={handleSave} className="px-4 py-2 bg-brand-main text-white text-sm font-semibold rounded-md hover:bg-brand-hover" data-testid="save-product-btn">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
