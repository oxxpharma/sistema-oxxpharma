import React, { useEffect, useState, useCallback } from 'react';
import { api, API_URL } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Plus, Edit, Trash2, Search, X, Upload, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  name: '', description: '', price: 0, discount_price: null,
  category: '', subcategory: '', images: [], stock: 0,
  active: true, featured: false, brand: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.get(`/api/admin/products?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`),
        api.get('/api/categories'),
      ]);
      setProducts(p.products || []);
      setCategories(c.categories || []);
      if (!form.category && c.categories?.[0]) {
        setForm(f => ({ ...f, category: f.category || c.categories[0].name }));
      }
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: categories[0]?.name || '' });
    setShowForm(true);
  };
  const openEdit = (p) => {
    setEditing(p.product_id);
    setForm({
      name: p.name, description: p.description, price: p.price,
      discount_price: p.discount_price, category: p.category,
      subcategory: p.subcategory || '', images: p.images || [],
      stock: p.stock, active: p.active, featured: p.featured,
      brand: p.brand || '',
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
        stock: parseInt(form.stock, 10) || 0,
      };
      if (editing) await api.put(`/api/admin/products/${editing}`, payload);
      else await api.post('/api/admin/products', payload);
      toast.success('Produto salvo');
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Excluir produto?')) return;
    try { await api.del(`/api/admin/products/${id}`); toast.success('Produto excluído'); load(); } catch (err) { toast.error(err.message); }
  };

  // Upload image as base64 (MVP - quando houver uma API de upload real, trocar)
  const uploadImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Imagem deve ter no máx 3MB'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(f => ({ ...f, images: [...(f.images || []), reader.result] }));
      setUploading(false);
      toast.success('Imagem adicionada');
    };
    reader.onerror = () => { setUploading(false); toast.error('Falha ao carregar'); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (i) => {
    setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));
  };

  return (
    <div data-testid="admin-products">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary">Produtos</h1>
        <Button onClick={openNew} data-testid="new-product-btn"><Plus className="w-4 h-4" /> Novo produto</Button>
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
                      <button onClick={() => openEdit(p)} className="p-2 hover:bg-bg-secondary rounded" data-testid={`edit-${p.product_id}`}><Edit className="w-4 h-4" /></button>
                      <button onClick={() => del(p.product_id)} className="p-2 hover:bg-red-50 text-red-500 rounded" data-testid={`del-${p.product_id}`}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-txt-secondary">Nenhum produto cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="product-form">
            <div className="sticky top-0 bg-white border-b border-border p-6 flex items-center justify-between">
              <h2 className="font-heading font-black text-xl">{editing ? 'Editar produto' : 'Novo produto'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-bg-secondary rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <Input label="Nome*" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Textarea label="Descrição*" required rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Categoria*" required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">Selecione</option>
                  {categories.map(c => <option key={c.category_id} value={c.name}>{c.name}</option>)}
                </Select>
                <Input label="Marca" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Preço*" type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                <Input label="Preço promocional" type="number" step="0.01" value={form.discount_price || ''} onChange={e => setForm({ ...form, discount_price: e.target.value || null })} />
                <Input label="Estoque" type="number" required value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
              </div>

              {/* Images */}
              <div>
                <label className="block text-sm font-medium text-txt-primary mb-1.5">Imagens</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(form.images || []).map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-bg-secondary group">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(i)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-brand-main/50 cursor-pointer flex items-center justify-center">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin text-brand-main" /> : <Upload className="w-5 h-5 text-txt-secondary" />}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadImage} data-testid="image-upload" />
                  </label>
                </div>
                <p className="text-xs text-txt-secondary">Clique para enviar imagens do produto (máx 3MB).</p>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativo</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} /> Destaque</label>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button type="submit" loading={saving} data-testid="save-product-btn">Salvar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
