import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Plus, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const empty = { name: '', description: '', image_url: '', parent: null, order: 0, active: true };

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/categories');
      setCats(d.categories || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, order: parseInt(form.order, 10) || 0 };
    try {
      if (editing) await api.put(`/api/admin/categories/${editing}`, payload);
      else await api.post('/api/admin/categories', payload);
      toast.success('Categoria salva');
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const del = async (id) => {
    if (!window.confirm('Excluir categoria?')) return;
    try { await api.del(`/api/admin/categories/${id}`); toast.success('Excluída'); load(); } catch (err) { toast.error(err.message); }
  };

  return (
    <div data-testid="admin-categories">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary">Categorias</h1>
        <Button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} data-testid="new-cat-btn"><Plus className="w-4 h-4" /> Nova categoria</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map(c => (
            <div key={c.category_id} className="bg-white rounded-xl border border-border p-4 flex items-start justify-between">
              <div>
                <div className="font-heading font-black">{c.name}</div>
                <div className="text-xs text-txt-secondary mt-0.5">Ordem: {c.order} · {c.active ? 'Ativa' : 'Inativa'}</div>
                {c.description && <p className="text-xs text-txt-secondary mt-2">{c.description}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(c.category_id); setForm({ ...c }); setShowForm(true); }} className="p-2 hover:bg-bg-secondary rounded" data-testid={`edit-cat-${c.category_id}`}><Edit className="w-4 h-4" /></button>
                <button onClick={() => del(c.category_id)} className="p-2 hover:bg-red-50 text-red-500 rounded" data-testid={`del-cat-${c.category_id}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {cats.length === 0 && <div className="col-span-full p-10 text-center text-txt-secondary bg-white rounded-xl border border-border">Nenhuma categoria.</div>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="border-b border-border p-5 flex items-center justify-between">
              <h2 className="font-heading font-black text-lg">{editing ? 'Editar categoria' : 'Nova categoria'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-bg-secondary rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <Input label="Nome*" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Textarea label="Descrição" rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
              <Input label="Ordem" type="number" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativa</label>
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
