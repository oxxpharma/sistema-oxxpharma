import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Ticket, Loader2, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

const EMPTY = {
  code: '', type: 'percent', value: 10,
  min_subtotal: 0, max_discount: '',
  valid_from: '', valid_until: '',
  usage_limit: '', per_user_limit: '',
  requires_login: false,
  applicable_user_categories: [],
  description: '', active: true,
};

export default function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get('/api/admin/coupons'),
        api.get('/api/admin/user-categories'),
      ]);
      setItems(a.coupons || []);
      setCats(b.categories || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const newCoupon = () => { setEditingId(null); setForm(EMPTY); setOpen(true); };
  const editCoupon = (c) => {
    setEditingId(c.coupon_id);
    setForm({
      ...EMPTY,
      ...c,
      max_discount: c.max_discount ?? '',
      usage_limit: c.usage_limit ?? '',
      per_user_limit: c.per_user_limit ?? '',
      valid_from: c.valid_from?.slice(0, 10) || '',
      valid_until: c.valid_until?.slice(0, 10) || '',
    });
    setOpen(true);
  };

  const toggleCat = (cid) => {
    const cur = new Set(form.applicable_user_categories);
    if (cur.has(cid)) cur.delete(cid); else cur.add(cid);
    setForm({ ...form, applicable_user_categories: [...cur] });
  };

  const save = async () => {
    if (!form.code.trim()) { toast.error('Informe o código'); return; }
    if (!form.value || Number(form.value) <= 0) { toast.error('Valor inválido'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        value: Number(form.value),
        min_subtotal: Number(form.min_subtotal || 0),
        max_discount: form.max_discount === '' ? null : Number(form.max_discount),
        usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
        per_user_limit: form.per_user_limit === '' ? null : Number(form.per_user_limit),
      };
      if (editingId) {
        await api.put(`/api/admin/coupons/${editingId}`, payload);
        toast.success('Cupom atualizado');
      } else {
        await api.post('/api/admin/coupons', payload);
        toast.success('Cupom criado');
      }
      setOpen(false);
      load();
    } catch (e) { toast.error(e?.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Excluir o cupom "${c.code}"?`)) return;
    try { await api.delete(`/api/admin/coupons/${c.coupon_id}`); toast.success('Excluído'); load(); }
    catch (e) { toast.error(e?.message || 'Erro'); }
  };

  return (
    <div data-testid="admin-coupons">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary">Cupons de desconto</h1>
          <p className="text-sm text-txt-secondary mt-1">Crie cupons em percentual ou valor fixo, com restrições de uso.</p>
        </div>
        <Button onClick={newCoupon} data-testid="coupon-new"><Plus className="w-4 h-4" /> Novo cupom</Button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand-main mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-txt-secondary text-sm">Nenhum cupom criado ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Desconto</th>
                <th className="text-left px-4 py-3">Pedido mín.</th>
                <th className="text-left px-4 py-3">Validade</th>
                <th className="text-left px-4 py-3">Usos</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(c => (
                <tr key={c.coupon_id} className="hover:bg-bg-secondary/40" data-testid={`coupon-row-${c.code}`}>
                  <td className="px-4 py-3 font-mono font-bold flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-brand-main" />{c.code}
                  </td>
                  <td className="px-4 py-3">{c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value)}</td>
                  <td className="px-4 py-3 text-xs text-txt-secondary">{c.min_subtotal ? formatCurrency(c.min_subtotal) : '-'}</td>
                  <td className="px-4 py-3 text-xs">{c.valid_until ? new Date(c.valid_until).toLocaleDateString('pt-BR') : 'Sem prazo'}</td>
                  <td className="px-4 py-3 text-xs">{c.usage_count || 0}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                  <td className="px-4 py-3"><Badge variant={c.active ? 'success' : 'secondary'}>{c.active ? 'Ativo' : 'Inativo'}</Badge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button variant="outline" size="sm" onClick={() => editCoupon(c)} data-testid={`coupon-edit-${c.code}`}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm" onClick={() => remove(c)} className="ml-1" data-testid={`coupon-del-${c.code}`}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-lg">{editingId ? 'Editar cupom' : 'Novo cupom'}</h2>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold block mb-1">Código *</label>
                <input className="w-full px-3 py-2 border border-border rounded-lg font-mono uppercase" data-testid="coupon-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DESCONTO10" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Tipo *</label>
                <select className="w-full px-3 py-2 border border-border rounded-lg text-sm" data-testid="coupon-type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Valor * {form.type === 'percent' ? '(0-100)' : '(R$)'}</label>
                <input type="number" min="0" max={form.type === 'percent' ? 100 : undefined} step="0.01" className="w-full px-3 py-2 border border-border rounded-lg" data-testid="coupon-value" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Subtotal mínimo (R$)</label>
                <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg" value={form.min_subtotal} onChange={e => setForm({ ...form, min_subtotal: e.target.value })} />
              </div>
              {form.type === 'percent' && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Desconto máx. (R$) <span className="text-txt-secondary font-normal">(opcional)</span></label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg" value={form.max_discount} onChange={e => setForm({ ...form, max_discount: e.target.value })} placeholder="Sem limite" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold block mb-1">Válido de</label>
                <input type="date" className="w-full px-3 py-2 border border-border rounded-lg" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Válido até</label>
                <input type="date" className="w-full px-3 py-2 border border-border rounded-lg" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Limite total de usos</label>
                <input type="number" min="1" className="w-full px-3 py-2 border border-border rounded-lg" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: e.target.value })} placeholder="Ilimitado" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Usos por usuário</label>
                <input type="number" min="1" className="w-full px-3 py-2 border border-border rounded-lg" value={form.per_user_limit} onChange={e => setForm({ ...form, per_user_limit: e.target.value })} placeholder="Ilimitado" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold block mb-1">Descrição (interna)</label>
                <input className="w-full px-3 py-2 border border-border rounded-lg" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold block mb-2">Restringir a categorias de usuários (opcional)</label>
                {cats.length === 0 ? (
                  <div className="text-xs text-txt-secondary">Crie categorias em "Categorias de usuários" para restringir.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cats.map(c => {
                      const sel = form.applicable_user_categories.includes(c.category_id);
                      return (
                        <button type="button" key={c.category_id} onClick={() => toggleCat(c.category_id)} className={`text-xs px-3 py-1.5 rounded-full border-2 transition ${sel ? 'text-white' : 'bg-white text-txt-primary'}`} style={{ borderColor: c.color, background: sel ? c.color : 'white' }}>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer md:col-span-2">
                <input type="checkbox" checked={form.requires_login} onChange={e => setForm({ ...form, requires_login: e.target.checked })} />
                Exige usuário logado
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer md:col-span-2">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                Ativo
              </label>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} loading={saving} data-testid="coupon-save">{editingId ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
