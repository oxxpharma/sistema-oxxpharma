import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Eye, Image as ImageIcon,
  Type, LayoutGrid, Tag, Megaphone, Minus, FileText, Box, Code, Upload, X, GalleryHorizontal, ShieldCheck, Layers, Columns,
} from 'lucide-react';
import { ICON_KEYS, ICON_LABELS, getIcon } from '../../lib/iconLibrary';
import DynamicBlocks from '../../components/store/DynamicBlocks';

const BLOCK_LIBRARY = [
  { type: 'hero', label: 'Banner Hero', icon: ImageIcon, desc: 'Banner principal com título + CTA' },
  { type: 'hero_carousel', label: 'Banner Carrossel', icon: GalleryHorizontal, desc: 'Vários slides girando automaticamente' },
  { type: 'section_title', label: 'Título de Seção', icon: Type, desc: 'Cabeçalho com subtítulo' },
  { type: 'rich_text', label: 'Texto / Título Rico', icon: Type, desc: 'Título com tag, cores variadas e estilos na mesma frase' },
  { type: 'product_grid', label: 'Grade de produtos', icon: LayoutGrid, desc: 'Destaques, categoria, manuais' },
  { type: 'category_grid', label: 'Grade de categorias', icon: Tag, desc: 'Mosaico de categorias com ícones' },
  { type: 'subcategory_grid', label: 'Grade de subcategorias', icon: Layers, desc: 'Mosaico de subcategorias com ícones' },
  { type: 'column_cards', label: 'Bloco de Colunas', icon: Columns, desc: 'Cards com imagem, título, texto e botão configurável' },
  { type: 'cta_banner', label: 'Banner CTA', icon: Megaphone, desc: 'Chamada com botão' },
  { type: 'trust_bar', label: 'Barra de Benefícios', icon: ShieldCheck, desc: 'Frete grátis, Pix, parcelamento, etc.' },
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
  section_title: { title: 'Em destaque', subtitle: '', align: 'left', eyebrow: '', eyebrow_color: '#E8731A', font_family: 'heading', size: '3xl' },
  rich_text: {
    eyebrow: 'PRODUTOS',
    eyebrow_color: '#E8731A',
    html: 'Encontre o cuidado que <span style="color: #E8731A">combina com você</span>',
    subtitle: 'Linhas completas para cada fase da sua vida.',
    font_family: 'serif',
    size: '3xl',
    align: 'center',
  },
  product_grid: { source: 'featured', category: '', product_ids: '', limit: 8, columns: 4 },
  category_grid: {
    selection_mode: 'all',
    selected_ids: [],
    include_all_card: true,
    all_card_label: 'Todos',
    all_card_position: 'start',
    all_card_link: '/produtos',
    limit: 16,
    columns: 8,
    show_all_button: true,
    button_label: 'VER TODOS OS PRODUTOS >',
    button_link: '/produtos',
  },
  subcategory_grid: {
    selection_mode: 'all',
    selected_ids: [],
    include_all_card: false,
    all_card_label: 'Todos',
    all_card_position: 'start',
    all_card_link: '/produtos',
    category_id: '',
    limit: 16,
    columns: 8,
    show_all_button: false,
    button_label: 'VER TODOS OS PRODUTOS >',
    button_link: '/produtos',
  },
  column_cards: {
    columns: 5,
    mobile_columns: 1,
    gap: 'medium',
    align: 'left',
    aspect_ratio: 'square',
    image_rounded: '2xl',
    button_style: 'circle_arrow',
    title_font: 'serif',
    title_size: 'xl',
    show_header: false,
    header_eyebrow: 'OXXPHARMA MAGISTRAL',
    header_title: 'Encontre o <span style="color: #E8731A">cuidado</span> que faz sentido para você.',
    header_subtitle: 'Soluções personalizadas para diferentes necessidades, momentos e objetivos.',
    header_align: 'center',
    items: [
      {
        title: 'Cuidado',
        description: 'Beleza, pele, cabelo e autocuidado.',
        image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500',
        link: '/loja',
        button_label: '',
      },
      {
        title: 'Bem-estar',
        description: 'Sono, equilíbrio, saúde intestinal e imunidade.',
        image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
        link: '/loja',
        button_label: '',
      },
      {
        title: 'Performance',
        description: 'Energia, força, treino e recuperação.',
        image_url: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500',
        link: '/loja',
        button_label: '',
      },
      {
        title: 'Metabolismo',
        description: 'Controle de peso, composição corporal e equilíbrio metabólico.',
        image_url: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=500',
        link: '/loja',
        button_label: '',
      },
      {
        title: 'Óleos Ozonizados',
        description: 'Soluções para diferentes necessidades de cuidado.',
        image_url: 'https://images.unsplash.com/photo-1608248597359-0080f55e5b70?w=500',
        link: '/loja',
        button_label: '',
      },
    ],
  },
  cta_banner: { title: 'Frete grátis acima de R$ 199', subtitle: 'Em todo o Brasil', cta_label: 'Comprar agora', cta_link: '/loja', bg_color: '' },
  trust_bar: {
    use_store_settings: true,
    items: [
      { icon: 'Truck', title: 'Frete grátis', desc: 'Em compras acima de R$ 500,00' },
      { icon: 'DollarSign', title: 'Desconto no Pix', desc: '3% Off' },
      { icon: 'CreditCard', title: 'Parcelamento', desc: 'em até 6x sem juros' },
    ],
  },
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
                <div className="bg-white border border-border rounded-lg max-h-[45vh] overflow-y-auto overflow-x-hidden">
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
  if (block.type === 'rich_text') return p.eyebrow ? `${p.eyebrow} · ${p.subtitle || 'Título'}` : (p.html ? 'Texto formatado' : 'Título rico');
  if (block.type === 'category_grid') {
    const mode = p.selection_mode === 'custom' ? `${(p.selected_ids || []).length} selecionadas` : (p.limit ? `${p.limit} categorias` : 'Todas');
    return `${mode} · ${p.columns || 8} cols${p.include_all_card !== false ? ' (+ Todos)' : ''}`;
  }
  if (block.type === 'subcategory_grid') {
    const mode = p.selection_mode === 'custom' ? `${(p.selected_ids || []).length} selecionadas` : (p.limit ? `${p.limit} subcategorias` : 'Todas');
    return `${mode} · ${p.columns || 8} cols${p.include_all_card ? ' (+ Todos)' : ''}`;
  }
  if (block.type === 'column_cards' || block.type === 'columns') {
    const count = (p.items || []).length;
    return `${count} coluna(s) · ${p.columns || 5} cols no desktop`;
  }
  if (block.type === 'image') return p.src ? '✓ imagem' : '(sem imagem)';
  if (block.type === 'spacer') return `${p.height || 40}px`;
  if (block.type === 'trust_bar') return p.use_store_settings ? 'Itens padrões da loja' : `${(p.items || []).length} benefício(s)`;
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
      <Input label="Tag Superior / Eyebrow (opcional)" value={p.eyebrow || ''} onChange={e => onChange({ eyebrow: e.target.value })} placeholder="Ex: PRODUTOS" />
      <Input label="Título" value={p.title || ''} onChange={e => onChange({ title: e.target.value })} />
      <Input label="Subtítulo" value={p.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      <SelectInput
        label="Família da Fonte"
        value={p.font_family || 'heading'}
        onChange={v => onChange({ font_family: v })}
        options={[
          { value: 'heading', label: 'Heading Marcante (OxxPharma)' },
          { value: 'serif', label: 'Serif Elegante' },
          { value: 'sans', label: 'Sans Moderno' },
        ]}
      />
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

  if (t === 'category_grid') return <CategoryGridBlockEditor props={p} onChange={onChange} />;

  if (t === 'subcategory_grid') return <SubcategoryGridBlockEditor props={p} onChange={onChange} />;

  if (t === 'rich_text') return <RichTextBlockEditor props={p} onChange={onChange} />;

  if (t === 'column_cards' || t === 'columns') return <ColumnCardsBlockEditor props={p} onChange={onChange} />;

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

  if (t === 'trust_bar') return <TrustBarBlockEditor props={p} onChange={onChange} />;

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
function TrustBarBlockEditor({ props, onChange }) {
  const items = Array.isArray(props.items) ? props.items : [];
  const useStore = props.use_store_settings ?? true;

  const updateItem = (index, patch) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange({ items: next, use_store_settings: false });
  };

  const addItem = () => {
    if (items.length >= 6) return;
    const next = [...items, { icon: 'Star', title: 'Novo Benefício', desc: 'Descrição curta' }];
    onChange({ items: next, use_store_settings: false });
  };

  const removeItem = (index) => {
    const next = items.filter((_, i) => i !== index);
    onChange({ items: next, use_store_settings: false });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-gray-50 border border-border rounded-xl space-y-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-txt-primary">
          <input
            type="checkbox"
            checked={useStore}
            onChange={(e) => onChange({ use_store_settings: e.target.checked })}
            className="w-4 h-4 rounded text-brand-main"
          />
          Usar benefícios configurados na loja (Aparência)
        </label>
        <p className="text-[11px] text-txt-secondary leading-relaxed">
          {useStore
            ? 'Este bloco exibirá automaticamente os itens de benefícios configurados globalmente no menu Aparência da loja.'
            : 'Personalize os itens de benefícios exclusivamente para esta seção abaixo.'}
        </p>
      </div>

      {!useStore && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Itens de Benefício ({items.length}/6)</span>
            {items.length < 6 && (
              <Button size="sm" variant="outline" onClick={addItem} className="text-xs h-7 gap-1">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            )}
          </div>

          {items.map((it, idx) => (
            <div key={idx} className="p-3 border border-border rounded-xl bg-white space-y-2 relative group">
              <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                <span className="text-xs font-bold text-brand-main">Benefício #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded transition"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-txt-secondary block mb-1">Ícone</label>
                <select
                  value={it.icon || 'Truck'}
                  onChange={(e) => updateItem(idx, { icon: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white"
                >
                  {ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {ICON_LABELS[k] || k}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Título"
                value={it.title || ''}
                onChange={(e) => updateItem(idx, { title: e.target.value })}
                placeholder="Ex: Frete Grátis"
              />

              <Input
                label="Descrição"
                value={it.desc || ''}
                onChange={(e) => updateItem(idx, { desc: e.target.value })}
                placeholder="Ex: Em compras acima de R$ 500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function RichTextBlockEditor({ props, onChange }) {
  const textareaRef = React.useRef(null);
  const [customColor, setCustomColor] = React.useState('#E8731A');

  const applyFormat = (openTag, closeTag) => {
    const el = textareaRef.current;
    const currentText = props.html || props.title || '';
    if (!el) {
      onChange({ html: currentText + openTag + 'texto' + closeTag });
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end) {
      const newText = currentText.slice(0, start) + openTag + 'texto' + closeTag + currentText.slice(end);
      onChange({ html: newText, title: newText });
    } else {
      const selected = currentText.slice(start, end);
      const newText = currentText.slice(0, start) + openTag + selected + closeTag + currentText.slice(end);
      onChange({ html: newText, title: newText });
    }
  };

  const applyColor = (hex) => {
    applyFormat(`<span style="color: ${hex}">`, '</span>');
  };

  const clearFormatting = () => {
    const currentText = props.html || props.title || '';
    const stripped = currentText.replace(/<[^>]*>/g, '');
    onChange({ html: stripped, title: stripped });
  };

  return (
    <div className="space-y-4">
      {/* Eyebrow / Tag superior */}
      <div className="p-3 bg-gray-50 border border-border rounded-xl space-y-2">
        <label className="text-xs font-bold text-txt-primary block">Tag Superior / Eyebrow (Opcional)</label>
        <p className="text-[11px] text-txt-secondary leading-relaxed">Ex: "PRODUTOS" em letras maiúsculas espaçadas acima do título.</p>
        <div className="flex items-center gap-2">
          <Input
            value={props.eyebrow || ''}
            onChange={(e) => onChange({ eyebrow: e.target.value })}
            placeholder="Ex: PRODUTOS"
          />
          <div className="flex items-center gap-1 shrink-0" title="Cor da Tag">
            <input
              type="color"
              value={props.eyebrow_color || '#E8731A'}
              onChange={(e) => onChange({ eyebrow_color: e.target.value })}
              className="w-8 h-8 p-0 border border-border rounded-lg cursor-pointer bg-white"
            />
          </div>
        </div>
      </div>

      {/* Editor do Título Principal com Formatação */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-txt-primary">Título Principal</label>
          <span className="text-[10px] text-txt-secondary">Selecione o trecho e clique nos botões</span>
        </div>

        {/* Toolbar de Formatação Rápida */}
        <div className="flex items-center gap-1.5 p-1.5 bg-gray-100/90 border border-border rounded-lg flex-wrap">
          <button
            type="button"
            onClick={() => applyColor('#E8731A')}
            className="px-2 py-0.5 text-xs font-bold text-white bg-brand-main hover:bg-brand-dark rounded shadow-2xs transition"
            title="Destacar com Laranja da Marca"
          >
            Laranja Oxx
          </button>
          <button
            type="button"
            onClick={() => applyFormat('<strong>', '</strong>')}
            className="w-7 h-6 flex items-center justify-center font-black text-xs bg-white hover:bg-gray-200 border border-gray-300 rounded transition"
            title="Negrito"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => applyFormat('<em>', '</em>')}
            className="w-7 h-6 flex items-center justify-center italic font-serif text-xs bg-white hover:bg-gray-200 border border-gray-300 rounded transition"
            title="Itálico"
          >
            I
          </button>

          {/* Cores rápidas */}
          <div className="flex items-center gap-1 border-l border-gray-300 pl-1.5 ml-0.5">
            {['#111827', '#E8731A', '#10B981', '#3B82F6', '#8B5CF6'].map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => applyColor(hex)}
                style={{ backgroundColor: hex }}
                className="w-4 h-4 rounded-full border border-white shadow-2xs hover:scale-125 transition"
                title={`Aplicar cor ${hex}`}
              />
            ))}
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                applyColor(e.target.value);
              }}
              className="w-5 h-5 p-0 border-0 rounded cursor-pointer ml-0.5"
              title="Cor personalizada"
            />
          </div>

          <button
            type="button"
            onClick={clearFormatting}
            className="ml-auto text-[10px] text-gray-500 hover:text-red-500 px-1 py-0.5 rounded transition"
            title="Remover formatação do título"
          >
            Limpar
          </button>
        </div>

        {/* Textarea do Título */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={props.html || props.title || ''}
          onChange={(e) => onChange({ html: e.target.value, title: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main leading-relaxed"
          placeholder="Ex: Encontre o cuidado que <span style='color: #E8731A'>combina com você</span>"
        />

        {/* Mini Preview do Título */}
        <div className="p-3 bg-white border border-dashed border-gray-200 rounded-xl space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-txt-secondary">Visualização:</div>
          {props.eyebrow && (
            <div
              className="text-[10px] uppercase font-extrabold tracking-[0.2em]"
              style={{ color: props.eyebrow_color || '#E8731A' }}
            >
              {props.eyebrow}
            </div>
          )}
          <div
            className={`text-sm leading-snug ${
              props.font_family === 'serif' ? 'font-serif' : props.font_family === 'sans' ? 'font-sans' : 'font-heading font-black'
            }`}
            dangerouslySetInnerHTML={{ __html: props.html || props.title || '<span class="text-gray-400 italic">Digite o título acima</span>' }}
          />
        </div>
      </div>

      {/* Subtítulo */}
      <Input
        label="Subtítulo"
        value={props.subtitle || ''}
        onChange={(e) => onChange({ subtitle: e.target.value })}
        placeholder="Ex: Linhas completas para cada fase da sua vida."
      />

      {/* Família da Fonte */}
      <SelectInput
        label="Família da Fonte do Título"
        value={props.font_family || 'serif'}
        onChange={(v) => onChange({ font_family: v })}
        options={[
          { value: 'serif', label: 'Serif Elegante (estilo print 2)' },
          { value: 'sans', label: 'Sans Moderno (Inter)' },
          { value: 'heading', label: 'Heading Marcante (OxxPharma)' },
        ]}
      />

      {/* Tamanho */}
      <SelectInput
        label="Tamanho do Título"
        value={props.size || '3xl'}
        onChange={(v) => onChange({ size: v })}
        options={[
          { value: 'xl', label: 'Pequeno (XL)' },
          { value: '2xl', label: 'Médio (2XL)' },
          { value: '3xl', label: 'Grande (3XL - Padrão)' },
          { value: '4xl', label: 'Extra Grande (4XL)' },
          { value: '5xl', label: 'Super Destaque (5XL)' },
        ]}
      />

      {/* Alinhamento */}
      <SelectInput
        label="Alinhamento"
        value={props.align || 'center'}
        onChange={(v) => onChange({ align: v })}
        options={[
          { value: 'center', label: 'Centralizado' },
          { value: 'left', label: 'À Esquerda' },
          { value: 'right', label: 'À Direita' },
        ]}
      />
    </div>
  );
}


function CategoryGridBlockEditor({ props, onChange }) {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/categories');
        setCategories(r.categories || r || []);
      } catch { /* silent */ }
    })();
  }, []);

  const isCustom = props.selection_mode === 'custom';
  const selectedIds = Array.isArray(props.selected_ids) ? props.selected_ids : [];

  const toggleCategory = (id) => {
    const cur = new Set(selectedIds);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    onChange({ selected_ids: [...cur], selection_mode: 'custom' });
  };

  const selectAll = () => {
    onChange({ selected_ids: categories.map((c) => c.category_id), selection_mode: 'custom' });
  };

  const deselectAll = () => {
    onChange({ selected_ids: [], selection_mode: 'custom' });
  };

  const filteredCategories = categories.filter((c) =>
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Modo de Seleção */}
      <div>
        <label className="text-xs font-bold text-txt-secondary block mb-1.5">Quais categorias exibir?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ selection_mode: 'all' })}
            className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              !isCustom
                ? 'bg-brand-main text-white border-brand-main shadow-xs'
                : 'bg-white border-border text-txt-primary hover:border-brand-main/40'
            }`}
          >
            Todas Categorias
          </button>
          <button
            type="button"
            onClick={() => onChange({ selection_mode: 'custom' })}
            className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              isCustom
                ? 'bg-brand-main text-white border-brand-main shadow-xs'
                : 'bg-white border-border text-txt-primary hover:border-brand-main/40'
            }`}
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Lista de Seleção Personalizada */}
      {isCustom && (
        <div className="space-y-2 p-3 bg-gray-50 border border-border rounded-xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-txt-primary">
              Selecione as Categorias ({selectedIds.length}/{categories.length})
            </span>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-brand-main hover:underline font-bold"
              >
                Todas
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-gray-500 hover:text-red-500 font-bold"
              >
                Nenhuma
              </button>
            </div>
          </div>

          {categories.length > 6 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar categoria..."
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-white"
            />
          )}

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-gray-200/60 rounded-lg p-2 bg-white">
            {filteredCategories.map((c) => {
              const checked = selectedIds.includes(c.category_id);
              const CatIcon = getIcon(c.icon || 'Sparkles');
              return (
                <label
                  key={c.category_id}
                  className={`flex items-center gap-2.5 p-1.5 rounded-lg text-xs cursor-pointer transition ${
                    checked ? 'bg-orange-50/70 text-brand-main font-bold' : 'hover:bg-gray-50 text-txt-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(c.category_id)}
                    className="w-4 h-4 rounded text-brand-main focus:ring-brand-main"
                  />
                  <div className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    {c.icon_svg ? (
                      <img src={c.icon_svg} alt={c.name} className="w-4 h-4 object-contain" />
                    ) : (
                      <CatIcon className="w-3.5 h-3.5 text-brand-main" />
                    )}
                  </div>
                  <span className="truncate">{c.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Card "Todos" */}
      <div className="p-3 bg-gray-50 border border-border rounded-xl space-y-2.5">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-txt-primary">
          <input
            type="checkbox"
            checked={props.include_all_card !== false}
            onChange={(e) => onChange({ include_all_card: e.target.checked })}
            className="w-4 h-4 rounded text-brand-main"
          />
          Colocar card "Todos" como se fosse uma categoria
        </label>
        <p className="text-[11px] text-txt-secondary leading-relaxed">
          Exibe um card "Todos" estilizado que leva o visitante para a listagem completa com todos os produtos da loja.
        </p>

        {props.include_all_card !== false && (
          <div className="pt-2 space-y-2 border-t border-gray-200/60">
            <Input
              label="Texto do card"
              value={props.all_card_label || 'Todos'}
              onChange={(e) => onChange({ all_card_label: e.target.value })}
              placeholder="Ex: Todos"
            />
            <SelectInput
              label="Posição do card 'Todos'"
              value={props.all_card_position || 'start'}
              onChange={(v) => onChange({ all_card_position: v })}
              options={[
                { value: 'start', label: 'No início (primeiro card)' },
                { value: 'end', label: 'No final (último card)' },
              ]}
            />
            <Input
              label="Link de destino"
              value={props.all_card_link || '/produtos'}
              onChange={(e) => onChange({ all_card_link: e.target.value })}
            />
          </div>
        )}
      </div>

      {!isCustom && (
        <Input
          label="Quantidade máxima de categorias"
          type="number"
          value={props.limit ?? 16}
          onChange={(e) => onChange({ limit: parseInt(e.target.value) || 0 })}
          placeholder="0 para todas"
        />
      )}

      <SelectInput
        label="Colunas no Desktop"
        value={String(props.columns || 8)}
        onChange={(v) => onChange({ columns: parseInt(v) })}
        options={[
          { value: '4', label: '4 colunas' },
          { value: '6', label: '6 colunas' },
          { value: '8', label: '8 colunas (recomendado)' },
        ]}
      />

      <div className="p-3 bg-gray-50 border border-border rounded-xl space-y-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-txt-primary">
          <input
            type="checkbox"
            checked={props.show_all_button !== false}
            onChange={(e) => onChange({ show_all_button: e.target.checked })}
            className="w-4 h-4 rounded text-brand-main"
          />
          Exibir botão "Ver todos os produtos" abaixo da grade
        </label>
        {props.show_all_button !== false && (
          <div className="pt-2 space-y-2 border-t border-gray-200/60">
            <Input
              label="Texto do botão"
              value={props.button_label || 'VER TODOS OS PRODUTOS >'}
              onChange={(e) => onChange({ button_label: e.target.value })}
            />
            <Input
              label="Link de destino"
              value={props.button_link || '/produtos'}
              onChange={(e) => onChange({ button_link: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SubcategoryGridBlockEditor({ props, onChange }) {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([
          api.get('/api/categories'),
          api.get('/api/subcategories'),
        ]);
        setCategories(c.categories || c || []);
        setSubcategories(s.subcategories || s || []);
      } catch { /* silent */ }
    })();
  }, []);

  const isCustom = props.selection_mode === 'custom';
  const selectedIds = Array.isArray(props.selected_ids) ? props.selected_ids : [];

  const toggleSubcategory = (id) => {
    const cur = new Set(selectedIds);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    onChange({ selected_ids: [...cur], selection_mode: 'custom' });
  };

  const selectAll = () => {
    onChange({ selected_ids: subcategories.map((s) => s.subcategory_id), selection_mode: 'custom' });
  };

  const deselectAll = () => {
    onChange({ selected_ids: [], selection_mode: 'custom' });
  };

  const filteredSubs = subcategories.filter((s) =>
    (s.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Modo de Seleção */}
      <div>
        <label className="text-xs font-bold text-txt-secondary block mb-1.5">Quais subcategorias exibir?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ selection_mode: 'all' })}
            className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              !isCustom
                ? 'bg-brand-main text-white border-brand-main shadow-xs'
                : 'bg-white border-border text-txt-primary hover:border-brand-main/40'
            }`}
          >
            Todas Subcategorias
          </button>
          <button
            type="button"
            onClick={() => onChange({ selection_mode: 'custom' })}
            className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              isCustom
                ? 'bg-brand-main text-white border-brand-main shadow-xs'
                : 'bg-white border-border text-txt-primary hover:border-brand-main/40'
            }`}
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Lista de Seleção Personalizada */}
      {isCustom && (
        <div className="space-y-2 p-3 bg-gray-50 border border-border rounded-xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-txt-primary">
              Selecione as Subcategorias ({selectedIds.length}/{subcategories.length})
            </span>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-brand-main hover:underline font-bold"
              >
                Todas
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-gray-500 hover:text-red-500 font-bold"
              >
                Nenhuma
              </button>
            </div>
          </div>

          {subcategories.length > 6 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar subcategoria..."
              className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-white"
            />
          )}

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-gray-200/60 rounded-lg p-2 bg-white">
            {filteredSubs.map((sc) => {
              const checked = selectedIds.includes(sc.subcategory_id);
              const SubIcon = getIcon(sc.icon || 'Sparkles');
              return (
                <label
                  key={sc.subcategory_id}
                  className={`flex items-center gap-2.5 p-1.5 rounded-lg text-xs cursor-pointer transition ${
                    checked ? 'bg-orange-50/70 text-brand-main font-bold' : 'hover:bg-gray-50 text-txt-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSubcategory(sc.subcategory_id)}
                    className="w-4 h-4 rounded text-brand-main focus:ring-brand-main"
                  />
                  <div className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    {sc.icon_svg ? (
                      <img src={sc.icon_svg} alt={sc.name} className="w-4 h-4 object-contain" />
                    ) : (
                      <SubIcon className="w-3.5 h-3.5 text-brand-main" />
                    )}
                  </div>
                  <span className="truncate">{sc.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Se modo "Todas", filtro opcional por categoria pai */}
      {!isCustom && (
        <div>
          <label className="text-xs font-bold text-txt-secondary block mb-1">Filtrar por Categoria Pai (Opcional)</label>
          <select
            value={props.category_id || ''}
            onChange={(e) => onChange({ category_id: e.target.value })}
            className="w-full px-2.5 py-2 border border-border rounded-lg text-xs bg-white font-medium"
          >
            <option value="">Todas as subcategorias</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                Apenas de: {c.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-txt-secondary mt-1">
            {props.category_id
              ? 'Mostrando apenas subcategorias vinculadas à categoria selecionada.'
              : 'Mostrando todas as subcategorias ativas da loja.'}
          </p>
        </div>
      )}

      {/* Card "Todos" */}
      <div className="p-3 bg-gray-50 border border-border rounded-xl space-y-2.5">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-txt-primary">
          <input
            type="checkbox"
            checked={Boolean(props.include_all_card)}
            onChange={(e) => onChange({ include_all_card: e.target.checked })}
            className="w-4 h-4 rounded text-brand-main"
          />
          Colocar card "Todos" como se fosse uma subcategoria
        </label>
        <p className="text-[11px] text-txt-secondary leading-relaxed">
          Exibe um card "Todos" estilizado que leva o visitante para a listagem completa com todos os produtos da loja.
        </p>

        {Boolean(props.include_all_card) && (
          <div className="pt-2 space-y-2 border-t border-gray-200/60">
            <Input
              label="Texto do card"
              value={props.all_card_label || 'Todos'}
              onChange={(e) => onChange({ all_card_label: e.target.value })}
              placeholder="Ex: Todos"
            />
            <SelectInput
              label="Posição do card 'Todos'"
              value={props.all_card_position || 'start'}
              onChange={(v) => onChange({ all_card_position: v })}
              options={[
                { value: 'start', label: 'No início (primeiro card)' },
                { value: 'end', label: 'No final (último card)' },
              ]}
            />
            <Input
              label="Link de destino"
              value={props.all_card_link || '/produtos'}
              onChange={(e) => onChange({ all_card_link: e.target.value })}
            />
          </div>
        )}
      </div>

      {!isCustom && (
        <Input
          label="Quantidade máxima de subcategorias"
          type="number"
          value={props.limit ?? 16}
          onChange={(e) => onChange({ limit: parseInt(e.target.value) || 0 })}
          placeholder="0 para todas"
        />
      )}

      <SelectInput
        label="Colunas no Desktop"
        value={String(props.columns || 8)}
        onChange={(v) => onChange({ columns: parseInt(v) })}
        options={[
          { value: '4', label: '4 colunas' },
          { value: '6', label: '6 colunas' },
          { value: '8', label: '8 colunas (recomendado)' },
        ]}
      />

      <div className="p-3 bg-gray-50 border border-border rounded-xl space-y-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-txt-primary">
          <input
            type="checkbox"
            checked={Boolean(props.show_all_button)}
            onChange={(e) => onChange({ show_all_button: e.target.checked })}
            className="w-4 h-4 rounded text-brand-main"
          />
          Exibir botão "Ver todos os produtos"
        </label>
        {Boolean(props.show_all_button) && (
          <div className="pt-2 space-y-2 border-t border-gray-200/60">
            <Input
              label="Texto do botão"
              value={props.button_label || 'VER TODOS OS PRODUTOS >'}
              onChange={(e) => onChange({ button_label: e.target.value })}
            />
            <Input
              label="Link de destino"
              value={props.button_link || '/produtos'}
              onChange={(e) => onChange({ button_link: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}


function ColumnCardsBlockEditor({ props, onChange }) {
  const items = Array.isArray(props.items) ? props.items : [];
  const [tab, setTab] = useState('columns');

  const updateItem = (index, patch) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange({ items: next });
  };

  const addItem = () => {
    if (items.length >= 12) {
      toast.error('Limite máximo de 12 colunas atingido');
      return;
    }
    const next = [
      ...items,
      {
        title: `Coluna ${items.length + 1}`,
        description: 'Descrição breve da coluna...',
        image_url: '',
        link: '/loja',
        button_label: '',
      },
    ];
    onChange({ items: next });
  };

  const removeItem = (index) => {
    const next = items.filter((_, i) => i !== index);
    onChange({ items: next });
  };

  const moveItem = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange({ items: next });
  };

  return (
    <div className="space-y-4" data-testid="column-cards-editor">
      {/* Abas internas para edição clara */}
      <div className="flex border-b border-border text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('columns')}
          className={`px-3 py-2 border-b-2 transition ${
            tab === 'columns'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          Colunas ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('layout')}
          className={`px-3 py-2 border-b-2 transition ${
            tab === 'layout'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          Layout & Estilo
        </button>
        <button
          type="button"
          onClick={() => setTab('header')}
          className={`px-3 py-2 border-b-2 transition ${
            tab === 'header'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          Cabeçalho
        </button>
      </div>

      {tab === 'layout' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <SelectInput
              label="Colunas no Computador"
              value={String(props.columns ?? 5)}
              onChange={(v) => onChange({ columns: Number(v) })}
              options={[
                { value: '2', label: '2 Colunas' },
                { value: '3', label: '3 Colunas' },
                { value: '4', label: '4 Colunas' },
                { value: '5', label: '5 Colunas (Padrão)' },
                { value: '6', label: '6 Colunas' },
              ]}
            />
            <SelectInput
              label="Colunas no Celular"
              value={String(props.mobile_columns ?? 1)}
              onChange={(v) => onChange({ mobile_columns: Number(v) })}
              options={[
                { value: '1', label: '1 Coluna' },
                { value: '2', label: '2 Colunas' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SelectInput
              label="Espaçamento (Gap)"
              value={props.gap || 'medium'}
              onChange={(v) => onChange({ gap: v })}
              options={[
                { value: 'none', label: 'Sem Espaçamento (0px)' },
                { value: 'small', label: 'Pequeno (12px)' },
                { value: 'medium', label: 'Médio (20px - Padrão)' },
                { value: 'large', label: 'Grande (32px)' },
              ]}
            />
            <SelectInput
              label="Alinhamento do Texto"
              value={props.align || 'left'}
              onChange={(v) => onChange({ align: v })}
              options={[
                { value: 'left', label: 'À Esquerda (Padrão)' },
                { value: 'center', label: 'Centralizado' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SelectInput
              label="Formato da Imagem"
              value={props.aspect_ratio || 'square'}
              onChange={(v) => onChange({ aspect_ratio: v })}
              options={[
                { value: 'square', label: 'Quadrada (1:1)' },
                { value: 'portrait', label: 'Vertical (4:5)' },
                { value: 'landscape', label: 'Horizontal (16:9)' },
                { value: 'auto', label: 'Altura Livre' },
              ]}
            />
            <SelectInput
              label="Arredondamento da Imagem"
              value={props.image_rounded || '2xl'}
              onChange={(v) => onChange({ image_rounded: v })}
              options={[
                { value: '2xl', label: 'Muito Arredondado (2xl)' },
                { value: 'xl', label: 'Arredondado (xl)' },
                { value: 'lg', label: 'Suave (lg)' },
                { value: 'none', label: 'Reto (Sem curva)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SelectInput
              label="Fonte do Título"
              value={props.title_font || 'serif'}
              onChange={(v) => onChange({ title_font: v })}
              options={[
                { value: 'serif', label: 'Tosh A (Serifado - Como no print)' },
                { value: 'anona', label: 'Anona (Moderno)' },
                { value: 'montserrat', label: 'Montserrat' },
                { value: 'sans', label: 'IBM Plex Sans (Padrão)' },
              ]}
            />
            <SelectInput
              label="Tamanho do Título"
              value={props.title_size || 'xl'}
              onChange={(v) => onChange({ title_size: v })}
              options={[
                { value: 'lg', label: 'Médio (18px)' },
                { value: 'xl', label: 'Grande (22px - Padrão)' },
                { value: '2xl', label: 'Extra Grande (24px)' },
              ]}
            />
          </div>

          <SelectInput
            label="Estilo do Botão"
            value={props.button_style || 'circle_arrow'}
            onChange={(v) => onChange({ button_style: v })}
            options={[
              { value: 'circle_arrow', label: 'Círculo com Seta (->) - Como no print' },
              { value: 'text_arrow', label: 'Texto com Seta (Ex: Saiba mais ->)' },
              { value: 'solid', label: 'Botão Sólido Preenchido' },
              { value: 'outline', label: 'Botão com Contorno' },
              { value: 'none', label: 'Sem Botão (Card Inteiro Clicável)' },
            ]}
          />
        </div>
      )}

      {tab === 'header' && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg bg-bg-secondary/40 border border-border">
            <input
              type="checkbox"
              checked={props.show_header === true}
              onChange={(e) => onChange({ show_header: e.target.checked })}
              className="rounded text-brand-main w-4 h-4"
            />
            <span className="text-xs font-semibold text-txt-primary">Exibir título e cabeçalho acima das colunas</span>
          </label>

          {props.show_header && (
            <div className="space-y-3 pt-1">
              <Input
                label="Tag Superior / Eyebrow"
                value={props.header_eyebrow || ''}
                onChange={(e) => onChange({ header_eyebrow: e.target.value })}
                placeholder="Ex: OXXPHARMA MAGISTRAL"
              />
              <Input
                label="Título Principal (HTML permitido)"
                value={props.header_title || ''}
                onChange={(e) => onChange({ header_title: e.target.value })}
                placeholder="Ex: Encontre o <span style='color: #E8731A'>cuidado</span> que faz sentido para você."
              />
              <Input
                label="Subtítulo / Descrição"
                value={props.header_subtitle || ''}
                onChange={(e) => onChange({ header_subtitle: e.target.value })}
                placeholder="Ex: Soluções personalizadas para diferentes necessidades..."
              />
              <SelectInput
                label="Alinhamento do Cabeçalho"
                value={props.header_align || 'center'}
                onChange={(v) => onChange({ header_align: v })}
                options={[
                  { value: 'center', label: 'Centralizado' },
                  { value: 'left', label: 'À Esquerda' },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'columns' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
              Colunas Adicionadas ({items.length})
            </div>
            <Button variant="outline" size="sm" onClick={addItem} data-testid="add-column-card">
              <Plus className="w-4 h-4 mr-1" /> Adicionar coluna
            </Button>
          </div>

          {items.map((it, idx) => (
            <div
              key={idx}
              className="border border-border rounded-lg p-3 bg-bg-secondary/30 space-y-2.5"
              data-testid={`column-card-item-${idx}`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-light text-brand-main text-[11px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-txt-primary truncate max-w-[130px]">
                    {it.title || `Coluna ${idx + 1}`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 hover:bg-white rounded disabled:opacity-30"
                    title="Mover para esquerda/cima"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="p-1 hover:bg-white rounded disabled:opacity-30"
                    title="Mover para direita/baixo"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                    title="Excluir coluna"
                    data-testid={`remove-column-card-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <ImageUploadField
                label="Imagem da Coluna"
                value={it.image_url || ''}
                onChange={(v) => updateItem(idx, { image_url: v })}
                testIdPrefix={`col-card-${idx}-img`}
              />

              <Input
                label="Título"
                value={it.title || ''}
                onChange={(e) => updateItem(idx, { title: e.target.value })}
                placeholder="Ex: Cuidado"
              />

              <div>
                <label className="text-xs font-bold text-txt-secondary block mb-1">Descrição</label>
                <textarea
                  value={it.description || ''}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  placeholder="Ex: Beleza, pele, cabelo e autocuidado."
                  rows={2}
                  className="w-full px-3 py-1.5 border border-border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Link de destino"
                  value={it.link || ''}
                  onChange={(e) => updateItem(idx, { link: e.target.value })}
                  placeholder="/loja"
                />
                {props.button_style !== 'circle_arrow' && props.button_style !== 'none' && (
                  <Input
                    label="Texto do botão"
                    value={it.button_label || ''}
                    onChange={(e) => updateItem(idx, { button_label: e.target.value })}
                    placeholder="Ex: Saiba mais"
                  />
                )}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="p-4 text-center text-txt-secondary text-xs bg-bg-secondary/20 rounded-lg">
              Nenhuma coluna adicionada. Clique abaixo para adicionar a primeira.
            </div>
          )}

          <Button variant="outline" size="sm" onClick={addItem} className="w-full mt-2" data-testid="add-column-card-bottom">
            <Plus className="w-4 h-4 mr-1" /> Adicionar coluna
          </Button>
        </div>
      )}
    </div>
  );
}
