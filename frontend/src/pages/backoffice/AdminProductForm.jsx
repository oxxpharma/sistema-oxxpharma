import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Trash2, Upload, Loader2, ArrowLeft, Save, GripVertical, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import RichTextEditor from '../../components/admin/RichTextEditor';

const emptyForm = {
  name: '', description: '', description_html: '', price: 0, discount_price: null,
  category: '', categories: [], subcategory: '', subcategories: [], images: [], stock: 0,
  active: true, featured: false, brand: '', points_value: 0,
  weight: null, length_cm: null, width_cm: null, height_cm: null,
  pricing_tiers: [],
  sku: '', ean: '',
  price_by_tenant: {},
  consumption_days: null,
  features: [],
  custom_fields: [],
  combo_pricing: [],
};

export default function AdminProductForm() {
  const nav = useNavigate();
  const { productId } = useParams();
  const isEdit = !!productId;

  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [userCats, setUserCats] = useState([]);
  const [fieldTemplates, setFieldTemplates] = useState([]);
  const [showTplManage, setShowTplManage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reset form to clean state (used after "Salvar e adicionar novo")
  const resetForm = useCallback(() => {
    setForm({ ...emptyForm, category: categories?.[0]?.name || '' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [categories]);

  const loadRefs = useCallback(async () => {
    const [c, sc, uc, tpls] = await Promise.all([
      api.get('/api/admin/categories').catch(() => api.get('/api/categories')),
      api.get('/api/admin/subcategories').catch(() => ({ subcategories: [] })),
      api.get('/api/admin/user-categories').catch(() => ({ categories: [] })),
      api.get('/api/admin/product-field-templates').catch(() => ({ templates: [] })),
    ]);
    setCategories(c.categories || []);
    setSubcategories(sc.subcategories || []);
    setUserCats(uc.categories || []);
    setFieldTemplates(tpls.templates || []);
    return c.categories || [];
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cats = await loadRefs();
        if (isEdit) {
          let prod = null;
          try {
            prod = await api.get(`/api/admin/products/${productId}`);
          } catch { /* fallback below */ }
          if (!prod) {
            const p = await api.get('/api/admin/products?limit=200');
            prod = (p.products || []).find(x => x.product_id === productId);
          }
          if (prod) {
            setForm({
              name: prod.name, description: prod.description, description_html: prod.description_html || '',
              price: prod.price, discount_price: prod.discount_price,
              category: prod.category,
              categories: Array.isArray(prod.categories) ? prod.categories : [],
              subcategory: prod.subcategory || '',
              subcategories: Array.isArray(prod.subcategories) ? prod.subcategories : [],
              images: prod.images || [],
              stock: prod.stock, active: prod.active, featured: prod.featured,
              brand: prod.brand || '', points_value: prod.points_value || 0,
              weight: prod.weight ?? null, length_cm: prod.length_cm ?? null,
              width_cm: prod.width_cm ?? null, height_cm: prod.height_cm ?? null,
              pricing_tiers: Array.isArray(prod.pricing_tiers) ? prod.pricing_tiers : [],
              sku: prod.sku || '', ean: prod.ean || '',
              price_by_tenant: prod.price_by_tenant || {},
              consumption_days: prod.consumption_days ?? null,
              features: Array.isArray(prod.features) ? prod.features : [],
              custom_fields: Array.isArray(prod.custom_fields) ? prod.custom_fields : [],
              combo_pricing: Array.isArray(prod.combo_pricing) ? prod.combo_pricing : [],
            });
          } else {
            toast.error('Produto nao encontrado');
            nav('/backoffice/produtos');
          }
        } else {
          setForm(f => ({ ...f, category: cats?.[0]?.name || '' }));
        }
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

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

  const removeImage = (i) => setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const buildPayload = () => {
    const tiers = (form.pricing_tiers || [])
      .filter(t => t && (t.price > 0))
      .filter(t => t.type !== 'category' || t.user_category_id)
      .filter(t => t.type !== 'network' || t.network_type)
      .map(t => ({ type: t.type, user_category_id: t.user_category_id || null, network_type: t.network_type || null, price: parseFloat(t.price) || 0, label: t.label || '' }));
    return {
      ...form,
      price: parseFloat(form.price),
      discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
      stock: parseInt(form.stock, 10) || 0,
      points_value: parseFloat(form.points_value || 0),
      pricing_tiers: tiers,
      sku: form.sku?.trim() || null,
      ean: form.ean?.trim() || null,
      price_by_tenant: Object.fromEntries(
        Object.entries(form.price_by_tenant || {})
          .map(([k, v]) => [k, parseFloat(v) || 0])
          .filter(([, v]) => v > 0)
      ),
      consumption_days: form.consumption_days ? parseInt(form.consumption_days, 10) : null,
      features: (form.features || []).map(f => String(f || '').trim()).filter(Boolean),
      custom_fields: (form.custom_fields || [])
        .map(f => ({ title: String(f.title || '').trim(), text: String(f.text || '').trim() }))
        .filter(f => f.title || f.text),
      combo_pricing: (form.combo_pricing || [])
        .map(c => ({
          qty: parseInt(c.qty, 10) || 0,
          price: parseFloat(c.price) || 0,
          discount_pct: parseFloat(c.discount_pct) || 0,
          days: c.days ? parseInt(c.days, 10) : null,
        }))
        .filter(c => c.qty > 0 && c.price > 0)
        .sort((a, b) => a.qty - b.qty),
      categories: Array.isArray(form.categories) ? form.categories : [],
      subcategories: Array.isArray(form.subcategories) ? form.subcategories : [],
    };
  };

  const save = async ({ addAnother = false } = {}) => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) await api.put(`/api/admin/products/${productId}`, payload);
      else await api.post('/api/admin/products', payload);
      toast.success(isEdit ? 'Produto atualizado' : 'Produto criado');
      if (addAnother && !isEdit) {
        resetForm();
      } else {
        nav('/backoffice/produtos');
      }
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); save({ addAnother: false }); };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-product-form-page" className="max-w-5xl mx-auto pb-24">
      {/* Header sticky */}
      <div className="sticky top-0 bg-bg-primary z-20 pb-4 -mx-4 px-4 md:mx-0 md:px-0 mb-6 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => nav('/backoffice/produtos')} className="p-2 hover:bg-bg-secondary rounded-lg" data-testid="back-btn"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary">{isEdit ? 'Editar produto' : 'Novo produto'}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="ghost" onClick={() => nav('/backoffice/produtos')} data-testid="cancel-btn">Cancelar</Button>
            {!isEdit && (
              <Button type="button" variant="outline" loading={saving} onClick={() => save({ addAnother: true })} data-testid="save-and-add-btn">
                <PlusCircle className="w-4 h-4" /> Salvar e adicionar novo
              </Button>
            )}
            <Button type="button" loading={saving} onClick={() => save({ addAnother: false })} data-testid="save-product-btn">
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-bg-primary" data-testid="product-form">
        <Input label="Nome*" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

        <div>
          <label className="text-sm font-bold text-txt-secondary block mb-1.5">Descrição*</label>
          <RichTextEditor
            value={form.description_html || form.description || ''}
            onChange={(html) => {
              const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
              setForm({ ...form, description_html: html, description: text || html });
            }}
            minHeight={340}
          />
        </div>

        <div className="border border-border rounded-lg p-4 bg-bg-secondary/40">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-bold text-sm">Características</div>
              <div className="text-xs text-txt-secondary">Aparecem em tópicos abaixo do nome do produto na página.</div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, features: [...(form.features || []), ''] })} data-testid="add-feature-btn">
              <Plus className="w-3 h-3" /> Item
            </Button>
          </div>
          {(form.features || []).length === 0 && <div className="text-xs text-txt-secondary py-2">Nenhum item ainda.</div>}
          <div className="space-y-2">
            {(form.features || []).map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-txt-secondary shrink-0" />
                <input type="text" value={feat}
                  onChange={(e) => { const arr = [...form.features]; arr[idx] = e.target.value; setForm({ ...form, features: arr }); }}
                  placeholder="Ex: Fórmula 100% natural"
                  className="flex-1 px-3 py-2 border border-border rounded text-sm"
                  data-testid={`feature-input-${idx}`} />
                <button type="button" className="p-1.5 text-red-600 hover:bg-red-50 rounded" onClick={() => setForm({ ...form, features: form.features.filter((_, i) => i !== idx) })}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-lg p-4 bg-bg-secondary/40">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <div className="font-bold text-sm">Campos personalizados</div>
              <div className="text-xs text-txt-secondary">Quadros com Título + Texto abaixo do botão de compra.</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select className="px-2 py-1.5 border border-border rounded text-xs"
                onChange={(e) => {
                  const tpl = fieldTemplates.find(t => t.template_id === e.target.value);
                  if (tpl) {
                    // Iter 66: aplica APENAS os titulos — nao copia o texto do produto anterior
                    const titlesOnly = (tpl.fields || []).map(f => ({ title: f.title || '', text: '' }));
                    setForm({ ...form, custom_fields: [...(form.custom_fields || []), ...titlesOnly] });
                    toast.success(`Template "${tpl.name}" aplicado (só títulos)`);
                  }
                  e.target.value = '';
                }} data-testid="apply-tpl-select">
                <option value="">Aplicar template…</option>
                {fieldTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
              </select>
              <Button type="button" size="sm" variant="outline" onClick={async () => {
                if (!(form.custom_fields || []).length) { toast.error('Adicione ao menos um campo antes de salvar.'); return; }
                const name = window.prompt('Nome do template:');
                if (!name) return;
                try {
                  await api.post('/api/admin/product-field-templates', { name, fields: form.custom_fields });
                  toast.success('Template salvo');
                  const r = await api.get('/api/admin/product-field-templates');
                  setFieldTemplates(r.templates || []);
                } catch (err) { toast.error(err.message); }
              }} data-testid="save-tpl-btn">
                <Save className="w-3 h-3" /> Salvar template
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowTplManage(true)} data-testid="manage-tpl-btn" disabled={!fieldTemplates.length}>
                Gerenciar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, custom_fields: [...(form.custom_fields || []), { title: '', text: '' }] })} data-testid="add-custom-field-btn">
                <Plus className="w-3 h-3" /> Campo
              </Button>
            </div>
          </div>
          {(form.custom_fields || []).length === 0 && <div className="text-xs text-txt-secondary py-2">Nenhum campo ainda.</div>}
          <div className="space-y-2">
            {(form.custom_fields || []).map((f, idx) => (
              <div key={idx} className="bg-white border border-border rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="text" value={f.title || ''} placeholder="Título (ex: Envio rápido)"
                    onChange={e => { const arr = [...form.custom_fields]; arr[idx] = { ...arr[idx], title: e.target.value }; setForm({ ...form, custom_fields: arr }); }}
                    className="flex-1 px-3 py-2 border border-border rounded text-sm font-semibold" data-testid={`cf-title-${idx}`} />
                  <button type="button" className="p-1.5 text-red-600 hover:bg-red-50 rounded" onClick={() => setForm({ ...form, custom_fields: form.custom_fields.filter((_, i) => i !== idx) })}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea value={f.text || ''} rows={2} placeholder="Texto explicativo…"
                  onChange={e => { const arr = [...form.custom_fields]; arr[idx] = { ...arr[idx], text: e.target.value }; setForm({ ...form, custom_fields: arr }); }}
                  className="w-full px-3 py-2 border border-border rounded text-sm" data-testid={`cf-text-${idx}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-lg p-4 bg-bg-secondary/40">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-bold text-sm">Combo de quantidade</div>
              <div className="text-xs text-txt-secondary">Preços especiais quando o cliente compra múltiplas unidades. Substitui outros descontos (cupom/pontos desabilitam o combo).</div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, combo_pricing: [...(form.combo_pricing || []), { qty: (form.combo_pricing?.length || 0) + 2, price: 0, discount_pct: 0, days: null }] })} data-testid="add-combo-btn">
              <Plus className="w-3 h-3" /> Combo
            </Button>
          </div>
          {(form.combo_pricing || []).length === 0 && <div className="text-xs text-txt-secondary py-2">Nenhum combo. O preço unitário se aplica a qualquer quantidade.</div>}
          <div className="space-y-2">
            {(form.combo_pricing || []).map((c, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 bg-white border border-border rounded p-2 items-center">
                <div className="col-span-2">
                  <label className="text-xs text-txt-secondary">Qtd.</label>
                  <input type="number" min="2" value={c.qty || ''} onChange={e => { const arr=[...form.combo_pricing]; arr[idx]={...arr[idx], qty: e.target.value}; setForm({...form, combo_pricing: arr}); }} className="w-full px-2 py-1 border border-border rounded text-sm" data-testid={`combo-qty-${idx}`} />
                </div>
                <div className="col-span-4">
                  <label className="text-xs text-txt-secondary">Preço TOTAL (R$)</label>
                  <input type="number" step="0.01" value={c.price || ''} onChange={e => { const arr=[...form.combo_pricing]; arr[idx]={...arr[idx], price: e.target.value}; setForm({...form, combo_pricing: arr}); }} className="w-full px-2 py-1 border border-border rounded text-sm" data-testid={`combo-price-${idx}`} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-txt-secondary">% off</label>
                  <input type="number" step="1" value={c.discount_pct || ''} onChange={e => { const arr=[...form.combo_pricing]; arr[idx]={...arr[idx], discount_pct: e.target.value}; setForm({...form, combo_pricing: arr}); }} className="w-full px-2 py-1 border border-border rounded text-sm" data-testid={`combo-off-${idx}`} />
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-txt-secondary">Dura (dias)</label>
                  <input type="number" min="1" value={c.days || ''} onChange={e => { const arr=[...form.combo_pricing]; arr[idx]={...arr[idx], days: e.target.value}; setForm({...form, combo_pricing: arr}); }} className="w-full px-2 py-1 border border-border rounded text-sm" placeholder="Ex: 60" data-testid={`combo-days-${idx}`} />
                </div>
                <div className="col-span-1 flex justify-end pt-4">
                  <button type="button" className="p-1.5 text-red-600 hover:bg-red-50 rounded" onClick={() => setForm({ ...form, combo_pricing: form.combo_pricing.filter((_, i) => i !== idx) })}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-bold text-txt-secondary block mb-1">Categorias*</label>
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-white">
              {categories.map(c => {
                const ids = Array.isArray(form.categories) ? form.categories : [];
                const checked = ids.includes(c.category_id);
                return (
                  <label key={c.category_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-bg-secondary/50 rounded px-1 py-0.5">
                    <input type="checkbox" checked={checked}
                      onChange={() => {
                        const next = checked ? ids.filter(x => x !== c.category_id) : [...ids, c.category_id];
                        const primaryName = next.length ? (categories.find(cc => cc.category_id === next[0])?.name || form.category) : '';
                        setForm({ ...form, categories: next, category: primaryName });
                      }}
                      data-testid={`cat-check-${c.category_id}`} />
                    <span>{c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-txt-secondary block mb-1">Subcategorias</label>
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-white">
              {subcategories.length === 0 && <div className="text-xs text-txt-secondary py-2">Nenhuma subcategoria cadastrada.</div>}
              {subcategories.map(sc => {
                const ids = Array.isArray(form.subcategories) ? form.subcategories : [];
                const checked = ids.includes(sc.subcategory_id);
                return (
                  <label key={sc.subcategory_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-bg-secondary/50 rounded px-1 py-0.5">
                    <input type="checkbox" checked={checked}
                      onChange={() => {
                        const next = checked ? ids.filter(x => x !== sc.subcategory_id) : [...ids, sc.subcategory_id];
                        setForm({ ...form, subcategories: next });
                      }}
                      data-testid={`subcat-check-${sc.subcategory_id}`} />
                    <span>{sc.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Marca" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
          <Input label="Tempo de consumo (dias)" type="number" min="0" value={form.consumption_days ?? ''} onChange={e => setForm({ ...form, consumption_days: e.target.value })} placeholder="Ex: 30" data-testid="prod-consumption" />
          <div />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Preço*" type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <Input label="Preço promocional" type="number" step="0.01" value={form.discount_price || ''} onChange={e => setForm({ ...form, discount_price: e.target.value || null })} />
          <Input label="Estoque" type="number" required value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Input label="Pontos por unidade" type="number" step="0.01" value={form.points_value} onChange={e => setForm({ ...form, points_value: e.target.value })} placeholder="Ex: 10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="SKU (codigo interno)" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Ex: VITC-500-30" data-testid="prod-sku" />
          <Input label="EAN (codigo de barras)" value={form.ean} onChange={e => setForm({ ...form, ean: e.target.value })} placeholder="Ex: 7891234567890" data-testid="prod-ean" />
        </div>

        <div className="border border-border rounded-lg p-4 bg-bg-secondary/40">
          <div className="font-bold text-sm mb-1">Preço por marca (opcional)</div>
          <div className="text-xs text-txt-secondary mb-3">Se deixar em branco, todas as marcas usam o preço base acima.</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-txt-secondary block mb-1">OxxPharma</label>
              <input type="number" step="0.01" placeholder="Usa preço base" value={form.price_by_tenant?.oxxpharma ?? ''} onChange={e => setForm({ ...form, price_by_tenant: { ...(form.price_by_tenant || {}), oxxpharma: e.target.value } })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" data-testid="price-tenant-oxxpharma" />
            </div>
            <div>
              <label className="text-xs font-bold text-txt-secondary block mb-1">Pharmakon</label>
              <input type="number" step="0.01" placeholder="Usa preço base" value={form.price_by_tenant?.pharmakon ?? ''} onChange={e => setForm({ ...form, price_by_tenant: { ...(form.price_by_tenant || {}), pharmakon: e.target.value } })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" data-testid="price-tenant-pharmakon" />
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-4 bg-bg-secondary/40">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-bold text-sm">Preços por contexto (opcional)</div>
              <div className="text-xs text-txt-secondary">Substitui o preço base quando a regra é atendida. Se houver mais de uma regra válida, vale o menor preço.</div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, pricing_tiers: [...(form.pricing_tiers || []), { type: 'logged', user_category_id: null, price: 0, label: '' }] })} data-testid="add-tier-btn">
              <Plus className="w-3 h-3" /> Regra
            </Button>
          </div>
          {(form.pricing_tiers || []).length === 0 && (<div className="text-xs text-txt-secondary py-2">Nenhuma regra. O preço base se aplica a todos.</div>)}
          <div className="space-y-2">
            {(form.pricing_tiers || []).map((t, idx) => {
              const update = (patch) => {
                const next = [...form.pricing_tiers];
                next[idx] = { ...next[idx], ...patch };
                if (patch.type && patch.type !== 'category') next[idx].user_category_id = null;
                if (patch.type && patch.type !== 'network') next[idx].network_type = null;
                setForm({ ...form, pricing_tiers: next });
              };
              const remove = () => setForm({ ...form, pricing_tiers: form.pricing_tiers.filter((_, i) => i !== idx) });
              return (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-white border border-border rounded-lg p-2 items-center">
                  <select className="md:col-span-3 px-2 py-1.5 border border-border rounded text-sm" value={t.type} onChange={e => update({ type: e.target.value })}>
                    <option value="guest">Não logado</option>
                    <option value="logged">Logado (qualquer)</option>
                    <option value="category">Categoria de usuário</option>
                    <option value="network">Rede do usuário</option>
                    <option value="referral_active">Ativo no Programa de Benefícios</option>
                  </select>
                  {t.type === 'category' ? (
                    <select className="md:col-span-4 px-2 py-1.5 border border-border rounded text-sm" value={t.user_category_id || ''} onChange={e => update({ user_category_id: e.target.value || null })}>
                      <option value="">Selecione a categoria...</option>
                      {userCats.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                    </select>
                  ) : t.type === 'network' ? (
                    <select className="md:col-span-4 px-2 py-1.5 border border-border rounded text-sm" value={t.network_type || ''} onChange={e => update({ network_type: e.target.value || null })}>
                      <option value="">Selecione a rede...</option>
                      <option value="customer">Consumidor</option>
                      <option value="network_1">Equipe 1 (Corporativa)</option>
                      <option value="network_2">Equipe 2 (Propagandista)</option>
                    </select>
                  ) : (
                    <input className="md:col-span-4 px-2 py-1.5 border border-border rounded text-sm" value={t.label || ''} placeholder="Rótulo (opcional)" onChange={e => update({ label: e.target.value })} />
                  )}
                  <input type="number" min="0" step="0.01" className="md:col-span-3 px-2 py-1.5 border border-border rounded text-sm" placeholder="Preço (R$)" value={t.price} onChange={e => update({ price: parseFloat(e.target.value) || 0 })} />
                  <Button type="button" variant="outline" size="sm" onClick={remove} className="md:col-span-2"><Trash2 className="w-3 h-3 text-red-500" /></Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Input label="Peso (kg)" type="number" step="0.001" value={form.weight ?? ''} onChange={e => setForm({ ...form, weight: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0.300" data-testid="prod-weight" />
          <Input label="Comprimento (cm)" type="number" step="0.1" value={form.length_cm ?? ''} onChange={e => setForm({ ...form, length_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="16" data-testid="prod-length" />
          <Input label="Largura (cm)" type="number" step="0.1" value={form.width_cm ?? ''} onChange={e => setForm({ ...form, width_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="11" data-testid="prod-width" />
          <Input label="Altura (cm)" type="number" step="0.1" value={form.height_cm ?? ''} onChange={e => setForm({ ...form, height_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="6" data-testid="prod-height" />
        </div>

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

        {/* Bottom actions (mirror header for long forms) */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
          <Button type="submit" loading={saving} data-testid="save-product-btn-bottom"><Save className="w-4 h-4" /> Salvar</Button>
          {!isEdit && (
            <Button type="button" variant="outline" loading={saving} onClick={() => save({ addAnother: true })} data-testid="save-and-add-btn-bottom">
              <PlusCircle className="w-4 h-4" /> Salvar e adicionar novo
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => nav('/backoffice/produtos')}>Cancelar</Button>
        </div>
      </form>

      {showTplManage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTplManage(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="border-b border-border p-5 flex items-center justify-between shrink-0">
              <h2 className="font-heading font-black text-lg">Gerenciar templates</h2>
              <button onClick={() => setShowTplManage(false)} className="p-1 hover:bg-bg-secondary rounded text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {fieldTemplates.length === 0 && <div className="text-sm text-txt-secondary text-center py-6">Nenhum template salvo.</div>}
              {fieldTemplates.map(t => (
                <div key={t.template_id} className="flex items-center justify-between border border-border rounded-lg p-3 gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{t.name}</div>
                    <div className="text-xs text-txt-secondary">{(t.fields || []).length} campo(s)</div>
                  </div>
                  <button type="button" className="p-2 text-red-600 hover:bg-red-50 rounded" data-testid={`del-tpl-${t.template_id}`}
                    onClick={async () => {
                      if (!window.confirm(`Excluir o template "${t.name}"?`)) return;
                      try {
                        await api.del(`/api/admin/product-field-templates/${t.template_id}`);
                        toast.success('Template excluído');
                        const r = await api.get('/api/admin/product-field-templates');
                        setFieldTemplates(r.templates || []);
                      } catch (err) { toast.error(err.message); }
                    }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-border shrink-0">
              <Button type="button" variant="outline" onClick={() => setShowTplManage(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
