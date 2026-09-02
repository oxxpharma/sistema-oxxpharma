import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Plus, Edit, Trash2, X, Loader2, Layers } from 'lucide-react';
import { toast } from 'sonner';

const empty = { name: '', description: '', image_url: '', parent: null, order: 0, active: true, slug: '', seo_title: '', seo_description: '' };
const emptySub = { name: '', description: '', category_ids: [], order: 0, active: true, slug: '', seo_title: '', seo_description: '' };

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [subForm, setSubForm] = useState(emptySub);

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api.get('/api/categories'),
        api.get('/api/admin/subcategories').catch(() => ({ subcategories: [] })),
      ]);
      setCats(c.categories || []);
      setSubs(s.subcategories || []);
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

  const submitSub = async (e) => {
    e.preventDefault();
    const payload = { ...subForm, order: parseInt(subForm.order, 10) || 0, category_ids: subForm.category_ids || [] };
    try {
      if (editingSub) await api.put(`/api/admin/subcategories/${editingSub}`, payload);
      else await api.post('/api/admin/subcategories', payload);
      toast.success('Subcategoria salva');
      setShowSubForm(false);
      setEditingSub(null);
      setSubForm(emptySub);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const delSub = async (id) => {
    if (!window.confirm('Excluir subcategoria?')) return;
    try { await api.del(`/api/admin/subcategories/${id}`); toast.success('Excluída'); load(); } catch (err) { toast.error(err.message); }
  };
  const catName = (id) => cats.find(c => c.category_id === id)?.name || id;

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

      {/* Iter 61: Subcategorias */}
      <div className="mt-10 flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="font-heading font-black text-2xl text-txt-primary flex items-center gap-2"><Layers className="w-6 h-6 text-brand-main" /> Subcategorias</h2>
        <Button onClick={() => { setEditingSub(null); setSubForm(emptySub); setShowSubForm(true); }} data-testid="new-subcat-btn"><Plus className="w-4 h-4" /> Nova subcategoria</Button>
      </div>
      <p className="text-xs text-txt-secondary mb-4">Uma subcategoria pode ser vinculada a uma ou mais categorias. Produtos aceitam múltiplas subcategorias.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {subs.map(sc => (
          <div key={sc.subcategory_id} className="bg-white rounded-xl border border-border p-4 flex items-start justify-between" data-testid={`subcat-card-${sc.subcategory_id}`}>
            <div>
              <div className="font-heading font-black">{sc.name}</div>
              <div className="text-xs text-txt-secondary mt-0.5">Ordem: {sc.order} · {sc.active ? 'Ativa' : 'Inativa'}</div>
              <div className="text-xs mt-1">
                {(sc.category_ids || []).length === 0 ? (
                  <span className="text-txt-secondary italic">Sem vínculos</span>
                ) : (
                  <span className="text-txt-secondary">Em: {sc.category_ids.map(catName).join(', ')}</span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditingSub(sc.subcategory_id); setSubForm({ ...sc, category_ids: sc.category_ids || [] }); setShowSubForm(true); }} className="p-2 hover:bg-bg-secondary rounded" data-testid={`edit-subcat-${sc.subcategory_id}`}><Edit className="w-4 h-4" /></button>
              <button onClick={() => delSub(sc.subcategory_id)} className="p-2 hover:bg-red-50 text-red-500 rounded" data-testid={`del-subcat-${sc.subcategory_id}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {subs.length === 0 && <div className="col-span-full p-10 text-center text-txt-secondary bg-white rounded-xl border border-border">Nenhuma subcategoria.</div>}
      </div>

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
              <div className="border-t border-border pt-3 mt-2">
                <div className="text-xs font-bold text-txt-secondary uppercase mb-2">SEO (Google)</div>
                <Input label="Slug (URL)" value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="deixe em branco para gerar automaticamente" hint="Ex: cuidados-com-a-pele → /categoria/cuidados-com-a-pele" data-testid="cat-slug" />
                <Input label="Título SEO" value={form.seo_title || ''} onChange={e => setForm({ ...form, seo_title: e.target.value })} placeholder="Título mostrado no Google (até 60 caracteres)" className="mt-2" />
                <Textarea label="Descrição SEO" rows={2} value={form.seo_description || ''} onChange={e => setForm({ ...form, seo_description: e.target.value })} placeholder="Descrição mostrada no Google (até 160 caracteres)" className="mt-2" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativa</label>
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSubForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSubForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="border-b border-border p-5 flex items-center justify-between">
              <h2 className="font-heading font-black text-lg">{editingSub ? 'Editar subcategoria' : 'Nova subcategoria'}</h2>
              <button onClick={() => setShowSubForm(false)} className="p-1 hover:bg-bg-secondary rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitSub} className="p-5 space-y-3">
              <Input label="Nome*" required value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} data-testid="subcat-name" />
              <Textarea label="Descrição" rows={2} value={subForm.description || ''} onChange={e => setSubForm({ ...subForm, description: e.target.value })} />
              <div>
                <label className="text-sm font-bold text-txt-secondary block mb-1">Vincular às categorias</label>
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                  {cats.map(c => {
                    const checked = (subForm.category_ids || []).includes(c.category_id);
                    return (
                      <label key={c.category_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-bg-secondary/50 rounded px-1 py-0.5">
                        <input
                          type="checkbox" checked={checked}
                          onChange={() => {
                            const cur = subForm.category_ids || [];
                            const next = checked ? cur.filter(x => x !== c.category_id) : [...cur, c.category_id];
                            setSubForm({ ...subForm, category_ids: next });
                          }}
                          data-testid={`subcat-cat-check-${c.category_id}`}
                        />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Input label="Ordem" type="number" value={subForm.order} onChange={e => setSubForm({ ...subForm, order: e.target.value })} />
              <div className="border-t border-border pt-3 mt-2">
                <div className="text-xs font-bold text-txt-secondary uppercase mb-2">SEO (Google)</div>
                <Input label="Slug (URL)" value={subForm.slug || ''} onChange={e => setSubForm({ ...subForm, slug: e.target.value })} placeholder="deixe em branco para gerar automaticamente" hint="Ex: hidratantes → /subcategoria/hidratantes" data-testid="subcat-slug" />
                <Input label="Título SEO" value={subForm.seo_title || ''} onChange={e => setSubForm({ ...subForm, seo_title: e.target.value })} placeholder="Título no Google" className="mt-2" />
                <Textarea label="Descrição SEO" rows={2} value={subForm.seo_description || ''} onChange={e => setSubForm({ ...subForm, seo_description: e.target.value })} placeholder="Descrição no Google" className="mt-2" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={subForm.active} onChange={e => setSubForm({ ...subForm, active: e.target.checked })} /> Ativa</label>
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button type="submit" data-testid="save-subcat">Salvar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowSubForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
