import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag, Loader2 } from 'lucide-react';

const PRESET_COLORS = ['#E8731A', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];
const EMPTY = { name: '', description: '', color: '#E8731A' };

export default function AdminUserCategories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/user-categories');
      setItems(d.categories || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const startEdit = (item) => {
    setEditingId(item.category_id);
    setForm({ name: item.name, description: item.description || '', color: item.color || '#E8731A' });
  };
  const cancel = () => { setEditingId(null); setForm(EMPTY); };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/admin/user-categories/${editingId}`, form);
        toast.success('Categoria atualizada');
      } else {
        await api.post('/api/admin/user-categories', form);
        toast.success('Categoria criada');
      }
      cancel();
      load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
    finally { setSaving(false); }
  };

  const remove = async (cat) => {
    if (!window.confirm(`Excluir a categoria "${cat.name}"? Será removida de todos os usuários.`)) return;
    try {
      await api.delete(`/api/admin/user-categories/${cat.category_id}`);
      toast.success('Excluída');
      load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
  };

  return (
    <div data-testid="admin-user-categories">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary">Categorias de usuários</h1>
          <p className="text-sm text-txt-secondary mt-1">Tags atribuíveis a usuários (ex: VIP, Atacado, Funcionário). Um usuário pode ter várias.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-border p-5 lg:col-span-1 h-fit">
          <h2 className="font-bold text-base mb-4">{editingId ? 'Editar categoria' : 'Nova categoria'}</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold block mb-1">Nome *</label>
              <input className="w-full px-3 py-2 border border-border rounded-lg text-sm" data-testid="cat-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Cliente VIP" />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Descrição</label>
              <textarea className="w-full px-3 py-2 border border-border rounded-lg text-sm min-h-[80px]" data-testid="cat-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Para que serve essa categoria?" />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`w-7 h-7 rounded-full border-2 ${form.color === c ? 'border-txt-primary scale-110' : 'border-white'} transition`} style={{ background: c }} aria-label={c} />
                ))}
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-7 h-7 rounded cursor-pointer" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={save} loading={saving} data-testid="cat-save">{editingId ? 'Salvar' : 'Criar'}</Button>
              {editingId && <Button variant="outline" onClick={cancel}>Cancelar</Button>}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-border lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-main" />
            <span className="font-bold">Todas as categorias ({items.length})</span>
          </div>
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand-main mx-auto" /></div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-txt-secondary text-sm">Nenhuma categoria cadastrada.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map(c => (
                <li key={c.category_id} className="p-4 flex items-center gap-3" data-testid={`cat-row-${c.slug}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{c.name}</div>
                    {c.description && <div className="text-xs text-txt-secondary truncate">{c.description}</div>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => startEdit(c)} data-testid={`cat-edit-${c.slug}`}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="outline" size="sm" onClick={() => remove(c)} data-testid={`cat-del-${c.slug}`}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
