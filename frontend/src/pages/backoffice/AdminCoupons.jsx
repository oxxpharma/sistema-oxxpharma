import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Ticket, Loader2, X, Package, Search, Tag, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

const EMPTY = {
  code: '', type: 'percent', value: 10,
  min_subtotal: 0, max_discount: '',
  valid_from: '', valid_until: '',
  usage_limit: '', per_user_limit: '',
  requires_login: false,
  applicable_user_categories: [],
  applicable_products: [],
  applicable_categories: [],
  applicable_subcategories: [],
  description: '', active: true,
};

export default function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);           // categorias de usuarios
  const [prodCats, setProdCats] = useState([]);   // categorias de produtos
  const [prodSubs, setProdSubs] = useState([]);   // subcategorias de produtos
  const [products, setProducts] = useState([]);   // catalogo de produtos
  const [prodSearch, setProdSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b, c, d, e] = await Promise.all([
        api.get('/api/admin/coupons'),
        api.get('/api/admin/user-categories').catch(() => ({ categories: [] })),
        api.get('/api/admin/categories').catch(() => api.get('/api/categories')).catch(() => ({ categories: [] })),
        api.get('/api/admin/subcategories').catch(() => ({ subcategories: [] })),
        api.get('/api/admin/products?limit=500').catch(() => api.get('/api/products?limit=500')).catch(() => ({ products: [] })),
      ]);
      setItems(a.coupons || []);
      setCats(b.categories || []);
      setProdCats(c.categories || []);
      setProdSubs(d.subcategories || []);
      setProducts(e.products || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const newCoupon = () => { setEditingId(null); setForm(EMPTY); setProdSearch(''); setOpen(true); };
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
      applicable_user_categories: Array.isArray(c.applicable_user_categories) ? c.applicable_user_categories : [],
      applicable_products: Array.isArray(c.applicable_products) ? c.applicable_products : [],
      applicable_categories: Array.isArray(c.applicable_categories) ? c.applicable_categories : [],
      applicable_subcategories: Array.isArray(c.applicable_subcategories) ? c.applicable_subcategories : [],
    });
    setProdSearch('');
    setOpen(true);
  };

  const toggleCat = (cid) => {
    const cur = new Set(form.applicable_user_categories);
    if (cur.has(cid)) cur.delete(cid); else cur.add(cid);
    setForm({ ...form, applicable_user_categories: [...cur] });
  };

  const toggleProdCat = (cid) => {
    const cur = new Set(form.applicable_categories || []);
    if (cur.has(cid)) cur.delete(cid); else cur.add(cid);
    setForm({ ...form, applicable_categories: [...cur] });
  };

  const toggleProdSub = (sid) => {
    const cur = new Set(form.applicable_subcategories || []);
    if (cur.has(sid)) cur.delete(sid); else cur.add(sid);
    setForm({ ...form, applicable_subcategories: [...cur] });
  };

  const toggleProduct = (pid) => {
    const cur = new Set(form.applicable_products || []);
    if (cur.has(pid)) cur.delete(pid); else cur.add(pid);
    setForm({ ...form, applicable_products: [...cur] });
  };

  const filteredProds = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => (
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    ));
  }, [products, prodSearch]);

  const selectedProductList = useMemo(() => {
    const setIds = new Set(form.applicable_products || []);
    return products.filter(p => setIds.has(p.product_id));
  }, [products, form.applicable_products]);

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
        applicable_user_categories: form.applicable_user_categories || [],
        applicable_products: form.applicable_products || [],
        applicable_categories: form.applicable_categories || [],
        applicable_subcategories: form.applicable_subcategories || [],
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
                <th className="text-left px-4 py-3">Abrangência</th>
                <th className="text-left px-4 py-3">Desconto</th>
                <th className="text-left px-4 py-3">Pedido mín.</th>
                <th className="text-left px-4 py-3">Validade</th>
                <th className="text-left px-4 py-3">Usos</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(c => {
                const pCount = (c.applicable_products || []).length;
                const cCount = (c.applicable_categories || []).length;
                const sCount = (c.applicable_subcategories || []).length;
                const hasRestr = pCount > 0 || cCount > 0 || sCount > 0;
                const parts = [];
                if (pCount) parts.push(`${pCount} prod.`);
                if (cCount) parts.push(`${cCount} cat.`);
                if (sCount) parts.push(`${sCount} sub.`);

                return (
                  <tr key={c.coupon_id} className="hover:bg-bg-secondary/40" data-testid={`coupon-row-${c.code}`}>
                    <td className="px-4 py-3 font-mono font-bold flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-brand-main" />{c.code}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {hasRestr ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium" title={parts.join(', ')}>
                          <Tag className="w-3 h-3 text-amber-600" />
                          Restrito ({parts.join(', ')})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-txt-secondary">
                          Todo o catálogo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">{c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value)}</td>
                    <td className="px-4 py-3 text-xs text-txt-secondary">{c.min_subtotal ? formatCurrency(c.min_subtotal) : '-'}</td>
                    <td className="px-4 py-3 text-xs">{c.valid_until ? new Date(c.valid_until).toLocaleDateString('pt-BR') : 'Sem prazo'}</td>
                    <td className="px-4 py-3 text-xs">{c.usage_count || 0}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                    <td className="px-4 py-3"><Badge variant={c.active ? 'success' : 'secondary'}>{c.active ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => editCoupon(c)} data-testid={`coupon-edit-${c.code}`}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => remove(c)} className="ml-1" data-testid={`coupon-del-${c.code}`}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Ticket className="w-5 h-5 text-brand-main" />
                {editingId ? 'Editar cupom' : 'Novo cupom'}
              </h2>
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

              {/* ==================== RESTRIÇÕES DE PRODUTOS, CATEGORIAS E SUBCATEGORIAS ==================== */}
              <div className="md:col-span-2 border border-brand-main/20 bg-brand-light/10 rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-txt-primary flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-brand-main" />
                      Restringir a Produtos / Categorias / Subcategorias (Opcional)
                    </h3>
                    <p className="text-xs text-txt-secondary mt-0.5">
                      Deixe em branco para que o cupom seja válido em <b>todo o site</b>. Caso marque produtos ou categorias específicas, o cupom só será aceito para eles.
                    </p>
                  </div>
                  {((form.applicable_categories?.length || 0) + (form.applicable_subcategories?.length || 0) + (form.applicable_products?.length || 0)) > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, applicable_categories: [], applicable_subcategories: [], applicable_products: [] })}
                      className="text-xs text-red-600 hover:underline font-medium shrink-0"
                    >
                      Limpar restrições
                    </button>
                  )}
                </div>

                {/* 1. Categorias */}
                <div>
                  <label className="text-xs font-semibold text-txt-primary block mb-1.5">
                    Categorias permitidas {form.applicable_categories?.length > 0 && `(${form.applicable_categories.length} selecionadas)`}
                  </label>
                  {prodCats.length === 0 ? (
                    <div className="text-xs text-txt-secondary">Nenhuma categoria encontrada.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white border border-border rounded-lg">
                      {prodCats.map(c => {
                        const sel = (form.applicable_categories || []).includes(c.category_id) || (form.applicable_categories || []).includes(c.name);
                        return (
                          <button
                            type="button"
                            key={c.category_id}
                            onClick={() => toggleProdCat(c.category_id)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                              sel
                                ? 'bg-brand-main text-white border-brand-main font-semibold shadow-sm'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {c.name}
                            {sel && <X className="w-3 h-3 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Subcategorias */}
                <div>
                  <label className="text-xs font-semibold text-txt-primary block mb-1.5">
                    Subcategorias permitidas {form.applicable_subcategories?.length > 0 && `(${form.applicable_subcategories.length} selecionadas)`}
                  </label>
                  {prodSubs.length === 0 ? (
                    <div className="text-xs text-txt-secondary">Nenhuma subcategoria cadastrada.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white border border-border rounded-lg">
                      {prodSubs.map(s => {
                        const sel = (form.applicable_subcategories || []).includes(s.subcategory_id) || (form.applicable_subcategories || []).includes(s.name);
                        return (
                          <button
                            type="button"
                            key={s.subcategory_id}
                            onClick={() => toggleProdSub(s.subcategory_id)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                              sel
                                ? 'bg-brand-main text-white border-brand-main font-semibold shadow-sm'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {s.name}
                            {sel && <X className="w-3 h-3 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Produtos Específicos */}
                <div>
                  <label className="text-xs font-semibold text-txt-primary block mb-1.5">
                    Produtos específicos {form.applicable_products?.length > 0 && `(${form.applicable_products.length} selecionados)`}
                  </label>

                  {/* Input de busca */}
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-txt-secondary" />
                    <input
                      type="text"
                      placeholder="Pesquisar produto por nome ou SKU..."
                      value={prodSearch}
                      onChange={e => setProdSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-brand-main"
                    />
                  </div>

                  {/* Resultados da busca rápida */}
                  {prodSearch.trim() && (
                    <div className="max-h-40 overflow-y-auto border border-border rounded-lg bg-white divide-y divide-border mb-2 shadow-sm">
                      {filteredProds.slice(0, 10).map(p => {
                        const sel = (form.applicable_products || []).includes(p.product_id);
                        return (
                          <div key={p.product_id} className="p-2 flex items-center justify-between hover:bg-bg-secondary/50 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              {p.images?.[0] ? (
                                <img src={p.images[0]} alt="" className="w-7 h-7 object-cover rounded border border-gray-200" />
                              ) : (
                                <Package className="w-7 h-7 text-gray-400 p-1 bg-gray-100 rounded" />
                              )}
                              <div className="truncate min-w-0">
                                <span className="font-semibold block truncate">{p.name}</span>
                                <span className="text-[10px] text-txt-secondary">{formatCurrency(p.price)} {p.sku ? `· SKU: ${p.sku}` : ''}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleProduct(p.product_id)}
                              className={`text-xs px-2.5 py-1 rounded font-medium ${
                                sel ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-brand-main text-white hover:opacity-90'
                              }`}
                            >
                              {sel ? 'Remover' : '+ Adicionar'}
                            </button>
                          </div>
                        );
                      })}
                      {filteredProds.length === 0 && (
                        <div className="p-3 text-center text-xs text-txt-secondary">Nenhum produto encontrado com esse nome/SKU.</div>
                      )}
                    </div>
                  )}

                  {/* Chips de produtos já selecionados */}
                  {selectedProductList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white border border-border rounded-lg">
                      {selectedProductList.map(p => (
                        <span
                          key={p.product_id}
                          className="inline-flex items-center gap-1.5 text-xs bg-brand-light/80 text-brand-dark px-2.5 py-1 rounded-full border border-brand-main/30 font-medium"
                        >
                          <span className="truncate max-w-[220px]" title={p.name}>{p.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleProduct(p.product_id)}
                            className="hover:text-red-600 p-0.5 rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-txt-secondary italic">Nenhum produto individual selecionado.</div>
                  )}
                </div>
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
            <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} loading={saving} data-testid="coupon-save">{editingId ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
