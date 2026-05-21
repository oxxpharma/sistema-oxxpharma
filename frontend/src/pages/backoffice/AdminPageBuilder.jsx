import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Eye, Image as ImageIcon,
  Type, LayoutGrid, Tag, Megaphone, Minus, FileText, Box, Code, Upload, X, GalleryHorizontal,
} from 'lucide-react';
import DynamicBlocks from '../../components/store/DynamicBlocks';

const BLOCK_LIBRARY = [
  { type: 'hero', label: 'Banner Hero', icon: ImageIcon, desc: 'Banner principal com título + CTA' },
  { type: 'hero_carousel', label: 'Banner Carrossel', icon: GalleryHorizontal, desc: 'Vários slides girando automaticamente' },
  { type: 'section_title', label: 'Título de Seção', icon: Type, desc: 'Cabeçalho com subtítulo' },
  { type: 'product_grid', label: 'Grade de produtos', icon: LayoutGrid, desc: 'Destaques, categoria, manuais' },
  { type: 'category_grid', label: 'Grade de categorias', icon: Tag, desc: 'Mosaico de categorias' },
  { type: 'cta_banner', label: 'Banner CTA', icon: Megaphone, desc: 'Chamada com botão' },
  { type: 'text', label: 'Bloco de texto', icon: FileText, desc: 'Texto/HTML livre' },
  { type: 'image', label: 'Imagem', icon: ImageIcon, desc: 'Imagem única (com link opcional)' },
  { type: 'divider', label: 'Divisor', icon: Minus, desc: 'Linha horizontal' },
  { type: 'spacer', label: 'Espaço', icon: Box, desc: 'Espaço vertical' },
  { type: 'html', label: 'HTML personalizado', icon: Code, desc: 'Código HTML livre (avançado)' },
];

const DEFAULT_PROPS = {
  hero: { title: 'Título', subtitle: 'Subtítulo', cta_label: 'Saiba mais', cta_link: '/loja', image_url: '', tagline: '', overlay_opacity: 0.4 },
  hero_carousel: {
    autoplay_seconds: 6,
    show_dots: true,
    slides: [
      { title: 'Slide 1', subtitle: '', image_url: '', cta_label: 'Comprar', cta_link: '/loja', overlay_opacity: 0.4 },
    ],
  },
  section_title: { title: 'Em destaque', subtitle: '', align: 'left' },
  product_grid: { source: 'featured', category: '', product_ids: '', limit: 8, columns: 4 },
  category_grid: { limit: 6 },
  cta_banner: { title: 'Frete grátis acima de R$ 199', subtitle: 'Em todo o Brasil', cta_label: 'Comprar agora', cta_link: '/loja', bg_color: '' },
  text: { html: '<p>Texto aqui...</p>', align: 'left' },
  image: { src: '', alt: '', link: '' },
  divider: {},
  spacer: { height: 40 },
  html: { html: '<!-- HTML aqui -->' },
};

export default function AdminPageBuilder() {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState(localStorage.getItem('admin_tenant') || 'oxxpharma');
  const [blocks, setBlocks] = useState([]);
  const [published, setPublished] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (tid) => {
    setLoading(true);
    try {
      const r = await api.get(`/api/admin/pages/home?tenant=${tid}`);
      setBlocks(r.blocks || []);
      setPublished(!!r.published);
      setSelectedId(null);
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/admin/tenants');
        setTenants(r.items || []);
      } catch { /* ignora */ }
      load(tenantId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTenant = (newId) => {
    setTenantId(newId);
    load(newId);
  };

  const addBlock = (type) => {
    const newId = `blk_${Math.random().toString(36).slice(2, 10)}`;
    const props = JSON.parse(JSON.stringify(DEFAULT_PROPS[type] || {}));
    setBlocks([...blocks, { id: newId, type, props }]);
    setSelectedId(newId);
  };
  const removeBlock = (id) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const moveBlock = (idx, dir) => {
    const next = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setBlocks(next);
  };
  const updateBlockProps = (id, patch) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, props: { ...b.props, ...patch } } : b));
  };

  const save = async (publish) => {
    setSaving(true);
    try {
      await api.put(`/api/admin/pages/home?tenant=${tenantId}`, {
        blocks,
        published: publish !== undefined ? publish : published,
      });
      if (publish !== undefined) setPublished(publish);
      toast.success(publish ? 'Página publicada!' : 'Rascunho salvo');
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally { setSaving(false); }
  };

  const selected = blocks.find(b => b.id === selectedId);

  return (
    <div className="space-y-4" data-testid="page-builder">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-black text-2xl">Page Builder · Home</h1>
          <p className="text-sm text-txt-secondary mt-1">
            Arraste blocos para construir a página inicial da sua marca.
            {published ? <span className="text-emerald-700 font-bold ml-2">● Publicado</span> : <span className="text-amber-700 font-bold ml-2">● Rascunho</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={tenantId}
            onChange={(e) => changeTenant(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white font-semibold"
            data-testid="builder-tenant-select"
          >
            {tenants.map(t => <option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>)}
          </select>
          <Button
            variant="outline"
            onClick={() => window.open(`/?as_tenant=${tenantId}`, '_blank')}
            data-testid="builder-preview"
          >
            <Eye className="w-4 h-4" /> Pré-visualizar
          </Button>
          <Button variant="outline" onClick={() => save()} loading={saving} data-testid="builder-save-draft">
            <Save className="w-4 h-4" /> Salvar rascunho
          </Button>
          <Button onClick={() => save(true)} loading={saving} data-testid="builder-publish">
            Publicar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-txt-secondary">Carregando...</div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Biblioteca de blocos */}
          <div className="col-span-12 lg:col-span-3 bg-white rounded-2xl border border-border p-3 lg:max-h-[80vh] lg:overflow-y-auto">
            <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-txt-secondary mb-3 px-1">Adicionar bloco</h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {BLOCK_LIBRARY.map(bt => {
                const Icon = bt.icon;
                return (
                  <button
                    key={bt.type}
                    onClick={() => addBlock(bt.type)}
                    className="text-left bg-bg-secondary hover:bg-bg-secondary/60 border border-border rounded-lg p-3 transition"
                    data-testid={`add-block-${bt.type}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-brand-main" />
                      <div className="font-bold text-sm">{bt.label}</div>
                    </div>
                    <div className="text-[11px] text-txt-secondary">{bt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canvas (lista de blocos) */}
          <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-border p-3 lg:max-h-[80vh] lg:overflow-y-auto">
            <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-txt-secondary mb-3 px-1">Blocos da página</h3>
            {blocks.length === 0 ? (
              <div className="text-center py-12 text-txt-secondary text-sm border-2 border-dashed border-border rounded-lg">
                Página vazia. Adicione blocos no painel da esquerda.
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map((b, idx) => {
                  const lib = BLOCK_LIBRARY.find(l => l.type === b.type);
                  const Icon = lib?.icon || Box;
                  const isSel = selectedId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedId(b.id)}
                      className={`border rounded-lg p-3 cursor-pointer transition ${isSel ? 'border-brand-main bg-brand-main/5' : 'border-border hover:border-brand-main/50'}`}
                      data-testid={`block-row-${b.type}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-brand-main shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">{lib?.label || b.type}</div>
                          <div className="text-[11px] text-txt-secondary truncate">{summary(b)}</div>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-bg-secondary rounded disabled:opacity-30" title="Subir"><ChevronUp className="w-4 h-4" /></button>
                          <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} className="p-1 hover:bg-bg-secondary rounded disabled:opacity-30" title="Descer"><ChevronDown className="w-4 h-4" /></button>
                          <button onClick={() => removeBlock(b.id)} className="p-1 hover:bg-red-50 text-red-600 rounded" title="Remover"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Preview ao vivo */}
            {blocks.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-txt-secondary mb-3">Pré-visualização</div>
                <div className="bg-bg-secondary rounded-lg p-3 space-y-6 max-h-[40vh] overflow-y-auto">
                  <DynamicBlocks blocks={blocks} />
                </div>
              </div>
            )}
          </div>

          {/* Editor do bloco selecionado */}
          <div className="col-span-12 lg:col-span-3 bg-white rounded-2xl border border-border p-3 lg:max-h-[80vh] lg:overflow-y-auto">
            <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-txt-secondary mb-3 px-1">Propriedades</h3>
            {!selected ? (
              <div className="text-center py-12 text-txt-secondary text-sm">Selecione um bloco para editar.</div>
            ) : (
              <BlockEditor block={selected} onChange={(patch) => updateBlockProps(selected.id, patch)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function summary(block) {
  const p = block.props || {};
  if (block.type === 'hero' || block.type === 'cta_banner' || block.type === 'section_title') return p.title || '(sem título)';
  if (block.type === 'hero_carousel') return `${(p.slides || []).length} slide(s)`;
  if (block.type === 'product_grid') return `${p.source} · ${p.limit || 8} produtos`;
  if (block.type === 'category_grid') return `${p.limit || 6} categorias`;
  if (block.type === 'image') return p.src ? '✓ imagem' : '(sem imagem)';
  if (block.type === 'spacer') return `${p.height || 40}px`;
  return block.type;
}

function BlockEditor({ block, onChange }) {
  const p = block.props || {};
  const t = block.type;

  if (t === 'hero') return (
    <div className="space-y-3">
      <Input label="Título" value={p.title || ''} onChange={e => onChange({ title: e.target.value })} />
      <Input label="Subtítulo" value={p.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      <Input label="Tagline (cima)" value={p.tagline || ''} onChange={e => onChange({ tagline: e.target.value })} />
      <ImageUploadField label="Imagem de fundo" value={p.image_url || ''} onChange={v => onChange({ image_url: v })} testIdPrefix="hero-bg" />
      <Input label="Rótulo do botão CTA" value={p.cta_label || ''} onChange={e => onChange({ cta_label: e.target.value })} />
      <Input label="Link do botão" value={p.cta_link || ''} onChange={e => onChange({ cta_link: e.target.value })} placeholder="/loja" />
      <RangeInput label="Opacidade do escurecimento" value={p.overlay_opacity ?? 0.4} onChange={(v) => onChange({ overlay_opacity: v })} />
    </div>
  );

  if (t === 'hero_carousel') return <CarouselEditor props={p} onChange={onChange} />;

  if (t === 'section_title') return (
    <div className="space-y-3">
      <Input label="Título" value={p.title || ''} onChange={e => onChange({ title: e.target.value })} />
      <Input label="Subtítulo" value={p.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      <SelectInput label="Alinhamento" value={p.align || 'left'} onChange={v => onChange({ align: v })} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }]} />
    </div>
  );

  if (t === 'product_grid') return (
    <div className="space-y-3">
      <SelectInput label="Fonte de produtos" value={p.source || 'featured'} onChange={v => onChange({ source: v })} options={[
        { value: 'featured', label: 'Destaques' },
        { value: 'newest', label: 'Mais novos' },
        { value: 'discount', label: 'Com desconto' },
        { value: 'category', label: 'Por categoria' },
        { value: 'manual', label: 'Manual (IDs)' },
      ]} />
      {p.source === 'category' && <Input label="Nome da categoria" value={p.category || ''} onChange={e => onChange({ category: e.target.value })} placeholder="Ex: Vitaminas" />}
      {p.source === 'manual' && <Input label="IDs dos produtos (vírgula)" value={p.product_ids || ''} onChange={e => onChange({ product_ids: e.target.value })} placeholder="prod_a,prod_b,prod_c" />}
      <Input label="Quantidade" type="number" value={p.limit || 8} onChange={e => onChange({ limit: parseInt(e.target.value) || 8 })} />
      <SelectInput label="Colunas (desktop)" value={String(p.columns || 4)} onChange={v => onChange({ columns: parseInt(v) })} options={[
        { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' },
      ]} />
    </div>
  );

  if (t === 'category_grid') return (
    <Input label="Quantidade" type="number" value={p.limit || 6} onChange={e => onChange({ limit: parseInt(e.target.value) || 6 })} />
  );

  if (t === 'cta_banner') return (
    <div className="space-y-3">
      <Input label="Título" value={p.title || ''} onChange={e => onChange({ title: e.target.value })} />
      <Input label="Subtítulo" value={p.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      <Input label="Botão" value={p.cta_label || ''} onChange={e => onChange({ cta_label: e.target.value })} />
      <Input label="Link" value={p.cta_link || ''} onChange={e => onChange({ cta_link: e.target.value })} />
      <Input label="Cor de fundo (CSS)" value={p.bg_color || ''} onChange={e => onChange({ bg_color: e.target.value })} placeholder="#E8731A ou linear-gradient(...)" />
    </div>
  );

  if (t === 'text' || t === 'html') return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-txt-secondary block">HTML</label>
      <textarea
        rows={8}
        value={p.html || ''}
        onChange={e => onChange({ html: e.target.value })}
        className="w-full px-3 py-2 border border-border rounded-lg text-xs font-mono"
      />
      {t === 'text' && <SelectInput label="Alinhamento" value={p.align || 'left'} onChange={v => onChange({ align: v })} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }]} />}
    </div>
  );

  if (t === 'image') return (
    <div className="space-y-3">
      <ImageUploadField label="Imagem" value={p.src || ''} onChange={v => onChange({ src: v })} testIdPrefix="image-block" />
      <Input label="Texto alternativo" value={p.alt || ''} onChange={e => onChange({ alt: e.target.value })} />
      <Input label="Link (opcional)" value={p.link || ''} onChange={e => onChange({ link: e.target.value })} />
    </div>
  );

  if (t === 'spacer') return (
    <Input label="Altura (px)" type="number" value={p.height || 40} onChange={e => onChange({ height: parseInt(e.target.value) || 40 })} />
  );

  if (t === 'divider') return <div className="text-xs text-txt-secondary">Bloco sem propriedades. Apenas uma linha divisória.</div>;

  return null;
}

function RangeInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-bold text-txt-secondary block mb-1">{label}: {value}</label>
      <input type="range" min="0" max="1" step="0.05" value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-bold text-txt-secondary block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/**
 * Campo de upload de imagem com preview. Envia o arquivo (base64) para
 * /api/admin/upload-image e devolve a URL. Tambem aceita colar URL manual.
 */
function ImageUploadField({ label, value, onChange, testIdPrefix = 'img' }) {
  const [busy, setBusy] = React.useState(false);
  const pick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files?.[0]; if (!file) return;
      if (file.size > 4 * 1024 * 1024) { toast.error('Imagem muito grande (max 4MB)'); return; }
      setBusy(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const r = await api.post('/api/admin/upload-image', { data: reader.result, name: file.name });
          onChange(r.url);
          toast.success('Imagem enviada');
        } catch (e) { toast.error(e?.message || 'Falha no upload'); }
        finally { setBusy(false); }
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  };
  return (
    <div>
      <label className="text-xs font-bold text-txt-secondary block mb-1">{label}</label>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative shrink-0">
            <img src={value} alt="preview" className="w-20 h-20 object-cover rounded-lg border border-border bg-bg-secondary" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
              title="Remover imagem"
              data-testid={`${testIdPrefix}-clear`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-bg-secondary flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6 text-txt-secondary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Button variant="outline" size="sm" onClick={pick} loading={busy} data-testid={`${testIdPrefix}-upload`}>
            <Upload className="w-4 h-4" /> {value ? 'Trocar imagem' : 'Enviar imagem'}
          </Button>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ou cole a URL"
            className="w-full mt-2 px-2 py-1 border border-border rounded text-xs font-mono"
            data-testid={`${testIdPrefix}-url`}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Editor do bloco hero_carousel: lista de slides (titulo, subtitulo, imagem,
 * CTA, overlay) + autoplay e indicadores.
 */
function CarouselEditor({ props, onChange }) {
  const slides = props.slides || [];
  const updateSlide = (idx, patch) => {
    const next = slides.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ slides: next });
  };
  const removeSlide = (idx) => onChange({ slides: slides.filter((_, i) => i !== idx) });
  const moveSlide = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ slides: next });
  };
  const addSlide = () => onChange({
    slides: [...slides, { title: `Slide ${slides.length + 1}`, subtitle: '', image_url: '', cta_label: 'Comprar', cta_link: '/loja', overlay_opacity: 0.4 }],
  });

  return (
    <div className="space-y-3" data-testid="carousel-editor">
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Autoplay (s)"
          type="number"
          value={props.autoplay_seconds ?? 6}
          onChange={(e) => onChange({ autoplay_seconds: parseInt(e.target.value || 0, 10) || 0 })}
        />
        <div>
          <label className="text-xs font-bold text-txt-secondary block mb-1">Indicadores</label>
          <label className="inline-flex items-center gap-2 h-10 cursor-pointer">
            <input
              type="checkbox"
              checked={props.show_dots !== false}
              onChange={(e) => onChange({ show_dots: e.target.checked })}
              data-testid="carousel-show-dots"
            />
            <span className="text-sm">Mostrar bolinhas</span>
          </label>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Slides ({slides.length})</div>
        {slides.map((s, idx) => (
          <div key={idx} className="border border-border rounded-lg p-3 bg-bg-secondary/30 space-y-2" data-testid={`carousel-slide-${idx}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase text-txt-secondary">Slide {idx + 1}</div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSlide(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-white rounded disabled:opacity-30" title="Subir"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => moveSlide(idx, 1)} disabled={idx === slides.length - 1} className="p-1 hover:bg-white rounded disabled:opacity-30" title="Descer"><ChevronDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => removeSlide(idx)} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Remover" data-testid={`carousel-slide-remove-${idx}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <Input label="Título" value={s.title || ''} onChange={(e) => updateSlide(idx, { title: e.target.value })} />
            <Input label="Subtítulo" value={s.subtitle || ''} onChange={(e) => updateSlide(idx, { subtitle: e.target.value })} />
            <ImageUploadField
              label="Imagem do slide"
              value={s.image_url || ''}
              onChange={(v) => updateSlide(idx, { image_url: v })}
              testIdPrefix={`carousel-slide-${idx}-img`}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Botão (CTA)" value={s.cta_label || ''} onChange={(e) => updateSlide(idx, { cta_label: e.target.value })} placeholder="Ex: Comprar" />
              <Input label="Link" value={s.cta_link || ''} onChange={(e) => updateSlide(idx, { cta_link: e.target.value })} placeholder="/loja" />
            </div>
            <RangeInput label="Escurecimento" value={s.overlay_opacity ?? 0.4} onChange={(v) => updateSlide(idx, { overlay_opacity: v })} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addSlide} data-testid="carousel-add-slide">
          <Plus className="w-4 h-4" /> Adicionar slide
        </Button>
      </div>
    </div>
  );
}
