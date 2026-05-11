import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { refreshSiteSettings } from '../../hooks/useSiteSettings';
import { Button } from '../../components/ui/Button';
import { Loader2, Save, Image as ImageIcon, Palette, Layout, Megaphone, Trash2, PlusCircle, Upload, BadgeCheck, Gift, Truck, Award, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ICON_LIBRARY, ICON_LABELS, ICON_KEYS, getIcon } from '../../lib/iconLibrary';

const TABS = [
  { key: 'identity', label: 'Identidade', icon: Palette },
  { key: 'logo_sizes', label: 'Logo por local', icon: ImageIcon },
  { key: 'hero', label: 'Banner principal', icon: Layout },
  { key: 'announcement', label: 'Barra de aviso', icon: Megaphone },
  { key: 'trust_bar', label: 'Barra de benefícios', icon: BadgeCheck },
  { key: 'referral_box', label: 'Programa de indicação', icon: Gift },
  { key: 'free_shipping', label: 'Frete grátis', icon: Truck },
  { key: 'points', label: 'Pontos', icon: Award },
  { key: 'product_card', label: 'Card do produto', icon: BadgeCheck },
  { key: 'footer', label: 'Rodapé', icon: Layout },
];

const LOGO_SLOTS = [
  { key: 'store_header',  label: 'Cabeçalho da loja',         desc: 'Topo de todas as páginas da loja' },
  { key: 'store_footer',  label: 'Rodapé da loja',            desc: 'Rodapé da loja pública' },
  { key: 'admin_sidebar', label: 'Menu do Painel Admin',      desc: 'Sidebar escura do /backoffice' },
  { key: 'admin_topbar',  label: 'Topo mobile do Admin',      desc: 'Barra superior do admin em celular' },
  { key: 'auth_pages',    label: 'Login e Cadastro',          desc: 'Páginas de autenticação' },
  { key: 'invoice',       label: 'Nota de faturamento',       desc: 'Documento imprimível do pedido' },
  { key: 'email_header',  label: 'Topo dos E-mails',          desc: 'Cabeçalho de todos os e-mails enviados' },
  { key: 'email_footer',  label: 'Rodapé dos E-mails',        desc: 'Parte de baixo dos e-mails' },
];

const DEFAULT_SIZES = {
  store_header:  { height: 40, max_width: 180 },
  store_footer:  { height: 36, max_width: 160 },
  admin_sidebar: { height: 36, max_width: 160 },
  admin_topbar:  { height: 28, max_width: 140 },
  auth_pages:    { height: 48, max_width: 200 },
  invoice:       { height: 56, max_width: 220 },
  email_header:  { height: 48, max_width: 200 },
  email_footer:  { height: 32, max_width: 140 },
};

export default function AdminAppearance() {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('identity');
  const [userCategories, setUserCategories] = useState([]);

  const load = async () => {
    try {
      const [settings, ucs] = await Promise.all([
        api.get('/api/site-settings'),
        api.get('/api/admin/user-categories').catch(() => ({ categories: [] })),
      ]);
      setS(settings);
      setUserCategories(ucs.categories || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setS(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...s }; delete payload.updated_at;
      await api.put('/api/admin/site-settings', payload);
      toast.success('Aparência salva!');
      await load();
      // invalida cache global do useSiteSettings → favicon, logos e título reagem na hora
      await refreshSiteSettings();
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const uploadImage = async (key, returnUrl = false) => {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = async () => {
        const file = inp.files?.[0]; if (!file) return resolve(null);
        if (file.size > 2 * 1024 * 1024) { toast.error('Imagem muito grande (max 2MB)'); return resolve(null); }
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            let dataUrl = reader.result;
            if (key === 'favicon_url') {
              dataUrl = await resizeToSquare(dataUrl, 64);
            }
            const r = await api.post('/api/admin/upload-image', { data: dataUrl, name: file.name });
            if (!returnUrl && key) set(key, r.url);
            toast.success(key === 'favicon_url' ? 'Favicon enviado (redimensionado para 64×64).' : 'Imagem enviada');
            resolve(r.url);
          } catch (e) { toast.error(e?.message); resolve(null); }
        };
        reader.readAsDataURL(file);
      };
      inp.click();
    });
  };

  // Redimensiona uma data URL para um quadrado 'size'x'size' centralizado
  // (mantem aspect ratio, preenche fundo transparente).
  const resizeToSquare = (dataUrl, size) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Fit dentro do quadrado mantendo proporcao
      const ratio = Math.min(size / img.width, size / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

  const setFooterPage = (i, patch) => set('footer_pages', s.footer_pages.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const removeFooterPage = (i) => set('footer_pages', s.footer_pages.filter((_, idx) => idx !== i));
  const addFooterPage = () => set('footer_pages', [...(s.footer_pages || []), { label: '', slug: '' }]);

  const setLogoSize = (slotKey, field, value) => {
    const sizes = { ...(s.logo_sizes || {}) };
    const cur = { ...DEFAULT_SIZES[slotKey], ...(sizes[slotKey] || {}) };
    cur[field] = Math.max(8, parseInt(value || 0, 10) || 0);
    sizes[slotKey] = cur;
    set('logo_sizes', sizes);
  };
  const resetLogoSize = (slotKey) => {
    const sizes = { ...(s.logo_sizes || {}) };
    sizes[slotKey] = { ...DEFAULT_SIZES[slotKey] };
    set('logo_sizes', sizes);
  };
  const getLogoSize = (slotKey) => {
    const saved = (s.logo_sizes || {})[slotKey];
    return { ...DEFAULT_SIZES[slotKey], ...(saved || {}) };
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!s) return null;

  return (
    <div data-testid="admin-appearance">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading font-black text-2xl flex items-center gap-3">
            <Palette className="w-7 h-7 text-brand-main" /> Aparência da Loja
          </h1>
          <p className="text-sm text-txt-secondary mt-1">Logo, banner, cores, rodapé — tudo da sua loja num só lugar.</p>
        </div>
        <Button onClick={save} disabled={saving} data-testid="save-appearance-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </Button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${tab === t.key ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid={`tab-${t.key}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Marca">
            <Field label="Nome da loja" value={s.store_name} onChange={(v) => set('store_name', v)} testId="store-name" />
            <Field label="Slogan / tagline" value={s.tagline} onChange={(v) => set('tagline', v)} />
            <ImageUpload label="Logo (header claro)" url={s.logo_url} onPick={() => uploadImage('logo_url')} onClear={() => set('logo_url', '')} testId="logo-upload" />
            <ImageUpload label="Logo escura (opcional)" url={s.logo_dark_url} onPick={() => uploadImage('logo_dark_url')} onClear={() => set('logo_dark_url', '')} />
            <ImageUpload label="Favicon (32×32)" url={s.favicon_url} onPick={() => uploadImage('favicon_url')} onClear={() => set('favicon_url', '')} />
          </Card>
          <Card title="Cores da marca">
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Primária" value={s.brand_primary_color} onChange={(v) => set('brand_primary_color', v)} testId="color-primary" />
              <ColorField label="Secundária" value={s.brand_secondary_color} onChange={(v) => set('brand_secondary_color', v)} />
            </div>
          </Card>
          <Card title="Redes sociais">
            <Field label="Instagram (URL)" value={s.social_instagram} onChange={(v) => set('social_instagram', v)} placeholder="https://instagram.com/oxxpharma" />
            <Field label="Facebook (URL)" value={s.social_facebook} onChange={(v) => set('social_facebook', v)} />
            <Field label="YouTube (URL)" value={s.social_youtube} onChange={(v) => set('social_youtube', v)} />
            <Field label="WhatsApp (URL ou número)" value={s.social_whatsapp} onChange={(v) => set('social_whatsapp', v)} placeholder="https://wa.me/5511999999999" />
          </Card>
        </div>
      )}

      {tab === 'logo_sizes' && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            Ajuste a <b>altura</b> e a <b>largura máxima</b> da logo em cada local. Se a logo não estiver configurada na aba <b>Identidade</b>, o sistema mostra automaticamente o <b>nome da loja</b>.
          </div>
          {LOGO_SLOTS.map(slot => {
            const size = getLogoSize(slot.key);
            const isDarkBg = slot.key === 'admin_sidebar';
            return (
              <Card key={slot.key} title={slot.label}>
                <p className="text-xs text-txt-secondary -mt-1 mb-3">{slot.desc}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Altura (px)</label>
                    <input
                      type="number" min="8" max="300" value={size.height}
                      onChange={(e) => setLogoSize(slot.key, 'height', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
                      data-testid={`logosize-${slot.key}-h`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Largura máx. (px)</label>
                    <input
                      type="number" min="20" max="600" value={size.max_width}
                      onChange={(e) => setLogoSize(slot.key, 'max_width', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
                      data-testid={`logosize-${slot.key}-w`}
                    />
                  </div>
                  <div>
                    <Button variant="outline" size="sm" onClick={() => resetLogoSize(slot.key)} data-testid={`logosize-${slot.key}-reset`}>
                      Restaurar padrão
                    </Button>
                  </div>
                </div>
                {/* Preview */}
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-secondary mb-2">Prévia</div>
                  <div
                    className={`rounded-lg border border-border p-4 flex items-center ${isDarkBg ? 'bg-[#1F2937]' : 'bg-bg-secondary'}`}
                  >
                    {s.logo_url ? (
                      <img
                        src={isDarkBg && s.logo_dark_url ? s.logo_dark_url : s.logo_url}
                        alt="preview"
                        className="object-contain"
                        style={{ height: `${size.height}px`, maxWidth: `${size.max_width}px` }}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className="rounded-lg bg-brand-main flex items-center justify-center"
                          style={{ width: `${Math.round(size.height * 0.85)}px`, height: `${Math.round(size.height * 0.85)}px` }}
                        >
                          <span className="text-white font-heading font-black" style={{ fontSize: `${Math.round(size.height * 0.45)}px` }}>
                            {(s.store_name || 'O')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className={`font-heading font-black ${isDarkBg ? 'text-white' : ''}`} style={{ fontSize: `${Math.max(14, Math.round(size.height * 0.45))}px` }}>
                          {s.store_name || 'OxxPharma'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'hero' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Banner principal (carrossel)">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">
              Adicione um ou mais slides com imagem, título, subtítulo e botão. Se houver mais de 1, eles giram automaticamente.
            </p>

            <HeroSlidesEditor
              slides={s.hero_slides || (s.hero_image_url ? [{
                title: s.hero_title, subtitle: s.hero_subtitle, image_url: s.hero_image_url,
                cta_label: s.hero_cta_label, cta_link: s.hero_cta_link,
                overlay_opacity: s.hero_overlay_opacity || 0,
              }] : [])}
              onChange={(slides) => set('hero_slides', slides)}
              uploadImage={uploadImage}
            />

            <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary block mb-1">Autoplay (segundos)</label>
                <input type="number" min="2" max="30" step="1" className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
                  value={s.hero_autoplay_seconds || 6}
                  onChange={(e) => set('hero_autoplay_seconds', parseInt(e.target.value, 10) || 6)}
                  data-testid="hero-autoplay-seconds" />
                <p className="text-[11px] text-txt-secondary mt-1">Tempo entre trocas. 0 = sem autoplay.</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary block mb-1">Mostrar indicadores</label>
                <label className="inline-flex items-center gap-2 cursor-pointer h-10">
                  <input type="checkbox" className="w-4 h-4" checked={s.hero_show_dots !== false} onChange={(e) => set('hero_show_dots', e.target.checked)} data-testid="hero-show-dots" />
                  <span className="text-sm">Bolinhas embaixo</span>
                </label>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'announcement' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Barra superior de aviso">
            <label className="inline-flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={!!s.announcement_bar_enabled} onChange={(e) => set('announcement_bar_enabled', e.target.checked)} className="w-5 h-5 accent-brand-main" data-testid="toggle-announcement" />
              <span className="text-sm font-semibold">{s.announcement_bar_enabled ? 'Ativada' : 'Desativada'}</span>
            </label>
            <Field label="Texto" value={s.announcement_bar_text} onChange={(v) => set('announcement_bar_text', v)} placeholder="🎉 Frete grátis acima de R$ 199!" />
            <Field label="Link (opcional)" value={s.announcement_bar_link} onChange={(v) => set('announcement_bar_link', v)} placeholder="/promocoes" />
            <ColorField label="Cor de fundo" value={s.announcement_bar_bg_color} onChange={(v) => set('announcement_bar_bg_color', v)} />
          </Card>
        </div>
      )}

      {tab === 'trust_bar' && (
        <div className="space-y-4 max-w-4xl">
          <Card title="Barra de benefícios (abaixo do rodapé)">
            <label className="flex items-center gap-2 cursor-pointer text-sm mb-3">
              <input type="checkbox" checked={s.trust_bar_enabled !== false} onChange={(e) => set('trust_bar_enabled', e.target.checked)} />
              Mostrar barra de benefícios na loja
            </label>
            <p className="text-xs text-txt-secondary mb-3">Até 6 itens (recomendado 3). Cada item tem ícone, título e descrição curta.</p>

            <div className="space-y-3">
              {(s.trust_items || []).map((item, idx) => (
                <TrustItemRow
                  key={idx}
                  item={item}
                  onChange={(patch) => {
                    const next = [...(s.trust_items || [])];
                    next[idx] = { ...next[idx], ...patch };
                    set('trust_items', next);
                  }}
                  onRemove={() => set('trust_items', (s.trust_items || []).filter((_, i) => i !== idx))}
                  onMove={(dir) => {
                    const arr = [...(s.trust_items || [])];
                    const j = idx + dir;
                    if (j < 0 || j >= arr.length) return;
                    [arr[idx], arr[j]] = [arr[j], arr[idx]];
                    set('trust_items', arr);
                  }}
                  canUp={idx > 0}
                  canDown={idx < (s.trust_items || []).length - 1}
                />
              ))}
            </div>
            {((s.trust_items || []).length < 6) && (
              <Button variant="outline" className="mt-3" onClick={() => set('trust_items', [...(s.trust_items || []), { icon: 'Star', title: 'Novo benefício', desc: 'Descrição' }])} data-testid="add-trust-item">
                <PlusCircle className="w-4 h-4" /> Adicionar benefício
              </Button>
            )}
          </Card>
        </div>
      )}

      {tab === 'referral_box' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Nome do programa">
            <Field label="Nome do programa (ex: Cartão de Benefícios)" value={s.referral_program_name} onChange={(v) => set('referral_program_name', v)} testId="ref-name" />
            <Field label='Texto do menu no topo do site (ex: "Indique e ganhe benefícios")' value={s.referral_menu_label} onChange={(v) => set('referral_menu_label', v)} testId="ref-menu-label" />
          </Card>

          <Card title="Caixa de adesão (página /minha-rede quando o usuário ainda não aderiu)">
            <Field label="Selo (ex: NOVO PROGRAMA)" value={s.referral_box_badge} onChange={(v) => set('referral_box_badge', v)} testId="ref-badge" />
            <Field label="Título principal (use \\n para quebrar linha)" value={s.referral_box_title} onChange={(v) => set('referral_box_title', v)} placeholder="Cartão de Benefícios&#10;Sua marca" testId="ref-title" multiline rows={2} hint="Deixe vazio para usar o nome do programa + nome da loja." />
            <Field label="Descrição (aceita HTML básico, ex: <b>texto</b>)" value={s.referral_box_description} onChange={(v) => set('referral_box_description', v)} testId="ref-desc" multiline rows={4} />
            <Field label="Texto do botão de adesão" value={s.referral_box_cta_label} onChange={(v) => set('referral_box_cta_label', v)} testId="ref-cta" />
          </Card>

          <Card title="Imagem decorativa (cartão / mockup) - opcional">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">Aparece no canto direito da caixa laranja, com leve rotação e podendo "vazar" para fora do quadro. Ideal: PNG transparente do cartão (recomendado 600×400px).</p>
            <ImageUpload label="Imagem do cartão / mockup" url={s.referral_box_image_url} onPick={() => uploadImage('referral_box_image_url')} onClear={() => set('referral_box_image_url', '')} testId="ref-box-image" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Largura na tela (ex: 320px ou 26rem)" value={s.referral_box_image_width} onChange={(v) => set('referral_box_image_width', v)} placeholder="320px" testId="ref-box-image-width" />
              <Field label="Rotação em graus (ex: -8 ou 12)" value={s.referral_box_image_rotation} onChange={(v) => set('referral_box_image_rotation', v)} placeholder="-8" testId="ref-box-image-rotation" />
              <Field label="Translate X (% — positivo = direita, negativo = esquerda)" value={s.referral_box_image_translate_x} onChange={(v) => set('referral_box_image_translate_x', v)} placeholder="12" testId="ref-box-image-tx" hint="Quanto a imagem vaza para fora do quadro pela direita." />
              <Field label="Translate Y (% — positivo = baixo, negativo = cima)" value={s.referral_box_image_translate_y} onChange={(v) => set('referral_box_image_translate_y', v)} placeholder="-50" testId="ref-box-image-ty" hint="-50 mantém centralizado verticalmente; reduza para subir." />
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={s.referral_box_image_float !== false}
                onChange={(e) => set('referral_box_image_float', e.target.checked)}
                data-testid="ref-box-image-float"
              />
              <span className="text-sm">Movimento suave de flutuação</span>
              <span className="text-xs text-txt-secondary">— animação contínua subindo e descendo levemente</span>
            </label>
          </Card>

          <Card title="Cards de destaque (até 3)">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">Aparecem abaixo do título da caixa laranja, mostrando os 3 principais benefícios.</p>
            <div className="space-y-3">
              {(s.referral_box_features || []).map((item, idx) => (
                <TrustItemRow
                  key={idx}
                  item={item}
                  onChange={(patch) => {
                    const next = [...(s.referral_box_features || [])];
                    next[idx] = { ...next[idx], ...patch };
                    set('referral_box_features', next);
                  }}
                  onRemove={() => set('referral_box_features', (s.referral_box_features || []).filter((_, i) => i !== idx))}
                  onMove={(dir) => {
                    const arr = [...(s.referral_box_features || [])];
                    const j = idx + dir;
                    if (j < 0 || j >= arr.length) return;
                    [arr[idx], arr[j]] = [arr[j], arr[idx]];
                    set('referral_box_features', arr);
                  }}
                  canUp={idx > 0}
                  canDown={idx < (s.referral_box_features || []).length - 1}
                />
              ))}
            </div>
            {((s.referral_box_features || []).length < 3) && (
              <Button variant="outline" className="mt-3" onClick={() => set('referral_box_features', [...(s.referral_box_features || []), { icon: 'Star', title: 'Novo benefício', desc: 'Descrição' }])} data-testid="add-ref-feature">
                <PlusCircle className="w-4 h-4" /> Adicionar destaque
              </Button>
            )}
          </Card>
        </div>
      )}

      {tab === 'free_shipping' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Configuração de Frete Grátis">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">Configure uma ou mais <strong>regras</strong>. O frete fica grátis se <strong>QUALQUER</strong> regra for satisfeita (lógica OR). Se uma regra exige <em>público</em> + <em>valor mínimo</em>, ambos precisam casar (AND interno).</p>

            {/* Toggle global */}
            <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg mb-4">
              <input
                type="checkbox"
                id="fs-enabled"
                checked={s.free_shipping_enabled !== false}
                onChange={(e) => set('free_shipping_enabled', e.target.checked)}
                className="w-4 h-4"
                data-testid="fs-enabled"
              />
              <label htmlFor="fs-enabled" className="text-sm font-semibold cursor-pointer flex-1">
                Frete grátis ativo
              </label>
              <span className="text-xs text-txt-secondary">{(s.free_shipping_rules || []).length} regra(s) configurada(s)</span>
            </div>

            <FreeShippingRules
              rules={s.free_shipping_rules || []}
              onChange={(rules) => set('free_shipping_rules', rules)}
              userCategories={userCategories}
            />

            <div className="mt-4 pt-3 border-t border-border">
              <Field label="Texto exibido na opção (ex: Frete grátis)" value={s.free_shipping_label} onChange={(v) => set('free_shipping_label', v)} testId="fs-label" />
            </div>
          </Card>

          <Card title="Provedor de cálculo de frete">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">Define qual serviço será consultado para calcular o frete na vitrine, carrinho e checkout.</p>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${(s.shipping_provider || 'correios') === 'correios' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="sp" checked={(s.shipping_provider || 'correios') === 'correios'} onChange={() => set('shipping_provider', 'correios')} className="mt-1" data-testid="sp-correios" />
                <div>
                  <div className="font-bold text-sm">Correios (API CWS)</div>
                  <div className="text-xs text-txt-secondary">Requer contrato direto com os Correios e token CWS configurado.</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${s.shipping_provider === 'melhorenvio' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="sp" checked={s.shipping_provider === 'melhorenvio'} onChange={() => set('shipping_provider', 'melhorenvio')} className="mt-1" data-testid="sp-me" />
                <div className="flex-1">
                  <div className="font-bold text-sm">Melhor Envio (multi-transportadora)</div>
                  <div className="text-xs text-txt-secondary">Correios PAC/SEDEX, JadLog, Loggi, Buslog, etc. Sem contrato direto. <a href="/backoffice/melhor-envio" className="text-brand-main underline">Configurar credenciais →</a></div>
                  {s.shipping_provider === 'melhorenvio' && (
                    <label className="flex items-center gap-2 mt-2 text-xs">
                      <input type="checkbox" checked={s.shipping_fallback_to_correios || false} onChange={(e) => set('shipping_fallback_to_correios', e.target.checked)} data-testid="sp-fallback" />
                      Usar Correios como fallback se o Melhor Envio falhar
                    </label>
                  )}
                </div>
              </label>
            </div>
          </Card>
        </div>
      )}

      {tab === 'product_card' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Badge para visitantes (não logados)">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">
              Quando o produto tem um "Preço para visitante" (tipo <span className="font-mono">guest</span>), aparece um selo no card. Aqui você define o texto global desse selo (sobrescreve o "Label" individual do produto).
            </p>
            <Field
              label="Texto do badge (ex: CADASTRE-SE E GANHE DESCONTO)"
              value={s.guest_tier_label_global}
              onChange={(v) => set('guest_tier_label_global', v)}
              placeholder="CADASTRE-SE E GANHE DESCONTO"
              testId="guest-tier-label-global"
              hint="Deixe vazio para usar o label individual de cada produto."
            />
          </Card>

          <Card title="Tamanho da fonte dos textos do produto (vitrine)">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">
              Ajuste o tamanho das letras em pixels. Vale para todos os cards de produto na loja pública.
            </p>
            <div className="space-y-3">
              <FontSizeSlider label="Marca (ex: VITAMINA)" value={s.product_card_brand_px} onChange={(v) => set('product_card_brand_px', v)} min={9} max={20} defaultV={11} />
              <FontSizeSlider label="Título do produto" value={s.product_card_title_px} onChange={(v) => set('product_card_title_px', v)} min={11} max={24} defaultV={14} />
              <FontSizeSlider label="Preço" value={s.product_card_price_px} onChange={(v) => set('product_card_price_px', v)} min={14} max={32} defaultV={18} />
              <FontSizeSlider label="Preço riscado (original)" value={s.product_card_strike_px} onChange={(v) => set('product_card_strike_px', v)} min={9} max={18} defaultV={12} />
              <FontSizeSlider label="Rótulos / badges (Clube, pontos, etc)" value={s.product_card_label_px} onChange={(v) => set('product_card_label_px', v)} min={9} max={18} defaultV={12} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'points' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Exibição de pontos por produto na loja">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">
              Controla para quem aparece o texto "Ganhe X pontos" embaixo do preço de cada produto. O valor em pontos é configurado individualmente em <span className="font-mono">Produtos → Pontos por unidade</span>.
            </p>
            <div className="space-y-2.5">
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${s.points_visibility_mode === 'none' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="pv_mode" checked={(s.points_visibility_mode || 'none') === 'none'} onChange={() => set('points_visibility_mode', 'none')} className="mt-1" data-testid="pv-none" />
                <div>
                  <div className="text-sm font-semibold">Não exibir para ninguém</div>
                  <div className="text-xs text-txt-secondary">Os pontos ficam ocultos na loja pública.</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${s.points_visibility_mode === 'all' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="pv_mode" checked={s.points_visibility_mode === 'all'} onChange={() => set('points_visibility_mode', 'all')} className="mt-1" data-testid="pv-all" />
                <div>
                  <div className="text-sm font-semibold">Exibir para todos</div>
                  <div className="text-xs text-txt-secondary">Inclusive visitantes não logados.</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${s.points_visibility_mode === 'selected' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="pv_mode" checked={s.points_visibility_mode === 'selected'} onChange={() => set('points_visibility_mode', 'selected')} className="mt-1" data-testid="pv-selected" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Exibir apenas para públicos selecionados</div>
                  <div className="text-xs text-txt-secondary mb-2">Escolha abaixo por tipo de rede ou por categoria de usuário.</div>
                  {s.points_visibility_mode === 'selected' && (
                    <div className="mt-2 space-y-3">
                      <AudienceGroup
                        title="Por tipo de conta"
                        options={[
                          { token: 'customer', label: 'Cliente (customer)' },
                          { token: 'network_1', label: 'Equipe 1 (Corporativa)' },
                          { token: 'network_2', label: 'Equipe 2 (Propagandista)' },
                        ]}
                        selected={s.points_visibility_audiences || []}
                        onToggle={(token) => toggleAudience(s, set, token)}
                      />
                      <AudienceGroup
                        title="Por categoria de usuário"
                        options={userCategories.map(c => ({ token: `cat:${c.category_id}`, label: c.name, color: c.color }))}
                        selected={s.points_visibility_audiences || []}
                        onToggle={(token) => toggleAudience(s, set, token)}
                        emptyText={<>Nenhuma categoria cadastrada. Crie em <span className="font-mono">/backoffice/categorias-usuarios</span>.</>}
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <Field label="Palavra exibida ao lado do número (ex: pontos, pts, OXX$)" value={s.points_visibility_label} onChange={(v) => set('points_visibility_label', v)} placeholder="pontos" testId="pv-label" />
            </div>
          </Card>
        </div>
      )}

      {tab === 'footer' && (
        <div className="space-y-4 max-w-3xl">
          <Card title="Sobre a empresa">
            <Field label="Texto sobre" value={s.footer_about} onChange={(v) => set('footer_about', v)} />
            <Field label="Email de contato" value={s.footer_contact_email} onChange={(v) => set('footer_contact_email', v)} type="email" />
            <Field label="Telefone" value={s.footer_contact_phone} onChange={(v) => set('footer_contact_phone', v)} />
            <Field label="Endereço" value={s.footer_address} onChange={(v) => set('footer_address', v)} />
          </Card>

          <Card title="Páginas do rodapé">
            <p className="text-xs text-txt-secondary mb-3">Links exibidos no rodapé. O slug deve corresponder a uma página criada em <b>Páginas</b>.</p>
            <div className="space-y-2">
              {(s.footer_pages || []).map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="text-[11px] font-semibold">Texto</label>
                    <input value={p.label} onChange={(e) => setFooterPage(i, { label: e.target.value })} className="w-full px-2 py-1.5 border border-border rounded text-sm" />
                  </div>
                  <div className="col-span-6">
                    <label className="text-[11px] font-semibold">Slug (ex: sobre, termos)</label>
                    <input value={p.slug} onChange={(e) => setFooterPage(i, { slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className="w-full px-2 py-1.5 border border-border rounded text-sm font-mono" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeFooterPage(i)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addFooterPage}><PlusCircle className="w-4 h-4" /> Adicionar link</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}


function toggleAudience(s, set, token) {
  const cur = new Set(s.points_visibility_audiences || []);
  if (cur.has(token)) cur.delete(token); else cur.add(token);
  set('points_visibility_audiences', [...cur]);
}

function toggleFsAudience(s, set, token) {
  const cur = new Set(s.free_shipping_audiences || []);
  if (cur.has(token)) cur.delete(token); else cur.add(token);
  set('free_shipping_audiences', [...cur]);
}

const ACCOUNT_TYPE_OPTS = [
  { token: 'customer', label: 'Cliente (customer)' },
  { token: 'network_1', label: 'Equipe 1 (Corporativa)' },
  { token: 'network_2', label: 'Equipe 2 (Propagandista)' },
];

function FreeShippingRules({ rules, onChange, userCategories }) {
  const update = (idx, patch) => {
    const next = rules.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onChange(next);
  };
  const add = (preset) => {
    const base = { name: '', account_types: [], categories: [], min_subtotal: 0 };
    onChange([...rules, { ...base, ...(preset || {}) }]);
  };
  const remove = (idx) => onChange(rules.filter((_, i) => i !== idx));

  if (rules.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center" data-testid="fs-empty-rules">
        <p className="text-sm text-txt-secondary mb-3">Nenhuma regra configurada — frete será calculado normalmente pelos Correios.</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="outline" onClick={() => add({ name: 'Frete grátis para tudo' })} data-testid="fs-add-rule-all">+ Frete grátis para tudo</Button>
          <Button variant="outline" onClick={() => add({ name: 'Frete grátis acima de R$ 199', min_subtotal: 199 })} data-testid="fs-add-rule-min">+ Acima de um valor</Button>
          <Button variant="outline" onClick={() => add({ name: 'Frete grátis Equipe', account_types: ['network_1', 'network_2'] })} data-testid="fs-add-rule-team">+ Para a Equipe</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="fs-rules-list">
      {rules.map((r, idx) => {
        const tokens = (r.account_types || []).concat((r.categories || []).map(c => `cat:${c}`));
        return (
          <div key={idx} className="border border-border rounded-lg p-4 bg-bg-secondary/30" data-testid={`fs-rule-${idx}`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={r.name || ''}
                  onChange={(e) => update(idx, { name: e.target.value })}
                  className="w-full text-sm font-bold bg-transparent border-b border-border focus:border-brand-main outline-none px-1 py-1"
                  placeholder={`Regra ${idx + 1}`}
                  data-testid={`fs-rule-name-${idx}`}
                />
              </div>
              <button onClick={() => remove(idx)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Remover regra" data-testid={`fs-rule-remove-${idx}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <AudienceGroup
                title="Tipo de conta (qualquer um marcado libera)"
                options={ACCOUNT_TYPE_OPTS}
                selected={tokens}
                onToggle={(token) => {
                  const cur = new Set(r.account_types || []);
                  if (cur.has(token)) cur.delete(token); else cur.add(token);
                  update(idx, { account_types: [...cur] });
                }}
              />
              <AudienceGroup
                title="Categoria de usuário"
                options={userCategories.map(c => ({ token: `cat:${c.category_id}`, label: c.name, color: c.color }))}
                selected={tokens}
                onToggle={(token) => {
                  const id = token.replace(/^cat:/, '');
                  const cur = new Set(r.categories || []);
                  if (cur.has(id)) cur.delete(id); else cur.add(id);
                  update(idx, { categories: [...cur] });
                }}
                emptyText={<>Nenhuma categoria cadastrada. Crie em <span className="font-mono">/backoffice/categorias-usuarios</span>.</>}
              />
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary block mb-1.5">Valor mínimo (R$) — opcional</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full md:w-1/2 px-3 py-2 border border-border rounded-lg text-sm font-mono"
                  value={r.min_subtotal || 0}
                  onChange={(e) => update(idx, { min_subtotal: parseFloat(e.target.value) || 0 })}
                  data-testid={`fs-rule-min-${idx}`}
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border text-xs text-txt-secondary">
              <strong>Resumo:</strong> {summarizeRule(r, userCategories)}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => add({ name: 'Nova regra' })} data-testid="fs-add-rule"><Plus className="w-4 h-4" /> Adicionar regra</Button>
      </div>
    </div>
  );
}

function summarizeRule(r, userCategories) {
  const parts = [];
  const types = r.account_types || [];
  if (types.length) parts.push(`tipo: ${types.join(', ')}`);
  const cats = (r.categories || []).map(id => {
    const c = userCategories.find(x => x.category_id === id);
    return c ? c.name : id;
  });
  if (cats.length) parts.push(`categoria: ${cats.join(', ')}`);
  if (r.min_subtotal > 0) parts.push(`compra ≥ R$ ${r.min_subtotal.toFixed(2)}`);
  if (parts.length === 0) return 'Libera para qualquer pessoa, em qualquer compra.';
  return parts.join(' E ');
}

function AudienceGroup({ title, options, selected, onToggle, emptyText }) {
  if (!options.length) {
    return (
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary mb-1.5">{title}</div>
        <div className="text-xs text-txt-secondary bg-bg-secondary rounded-md px-3 py-2">{emptyText || 'Nenhuma opção disponível.'}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSel = selected.includes(opt.token);
          const color = opt.color || '#E8731A';
          return (
            <button
              type="button"
              key={opt.token}
              onClick={() => onToggle(opt.token)}
              className="text-xs px-3 py-1.5 rounded-full border-2 transition font-semibold"
              style={{ borderColor: color, color: isSel ? 'white' : color, background: isSel ? color : 'white' }}
              data-testid={`pv-aud-${opt.token}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-border p-6 space-y-3">
      <h3 className="font-heading font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, value, onChange, type = 'text', placeholder, testId, multiline, rows = 3, hint }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      {multiline ? (
        <textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main resize-y"
          data-testid={testId} />
      ) : (
        <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
          data-testid={testId} />
      )}
      {hint && <div className="text-[11px] text-txt-secondary mt-1">{hint}</div>}
    </div>
  );
}
function ColorField({ label, value, onChange, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-12 h-10 border border-border rounded cursor-pointer" data-testid={testId} />
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono" />
      </div>
    </div>
  );
}
function ImageUpload({ label, url, onPick, onClear, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative">
            <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border bg-bg-secondary" />
            <button onClick={onClear} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"><Trash2 className="w-3 h-3" /></button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-bg-secondary flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-txt-secondary" />
          </div>
        )}
        <Button variant="outline" size="sm" onClick={onPick} data-testid={testId}><Upload className="w-4 h-4" /> {url ? 'Trocar' : 'Enviar imagem'}</Button>
      </div>
    </div>
  );
}


function TrustItemRow({ item, onChange, onRemove, onMove, canUp, canDown }) {
  const Icon = getIcon(item?.icon);
  return (
    <div className="border border-border rounded-lg p-4 bg-white grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-3 items-start">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-brand-main" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <IconPicker value={item?.icon || 'Star'} onChange={(v) => onChange({ icon: v })} />
        <div />
        <Field label="Título" value={item?.title} onChange={(v) => onChange({ title: v })} />
        <Field label="Descrição" value={item?.desc} onChange={(v) => onChange({ desc: v })} />
      </div>
      <div className="flex md:flex-col gap-1 self-center md:self-start">
        <button type="button" onClick={() => onMove(-1)} disabled={!canUp} className="px-2 py-1 text-xs border border-border rounded hover:bg-bg-secondary disabled:opacity-40" title="Mover para cima">↑</button>
        <button type="button" onClick={() => onMove(1)} disabled={!canDown} className="px-2 py-1 text-xs border border-border rounded hover:bg-bg-secondary disabled:opacity-40" title="Mover para baixo">↓</button>
        <button type="button" onClick={onRemove} className="px-2 py-1 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50" title="Remover">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const CurIcon = getIcon(value);
  const filtered = ICON_KEYS.filter(k => {
    if (!query) return true;
    const q = query.toLowerCase();
    return k.toLowerCase().includes(q) || (ICON_LABELS[k] || '').toLowerCase().includes(q);
  });

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-semibold block mb-1">Ícone</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:border-brand-main transition"
        data-testid="icon-picker-trigger"
      >
        <CurIcon className="w-4 h-4 text-brand-main" />
        <span className="flex-1 text-left truncate">{ICON_LABELS[value] || value || 'Escolher ícone'}</span>
        <span className="text-xs text-txt-secondary">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 bg-white border border-border rounded-lg shadow-lg w-72 p-2 max-h-72 overflow-y-auto" data-testid="icon-picker-popover">
          <input
            autoFocus
            placeholder="Buscar ícone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-2 py-1.5 border border-border rounded text-xs mb-2 sticky top-0 bg-white"
          />
          <div className="grid grid-cols-6 gap-1">
            {filtered.map(key => {
              const Icn = ICON_LIBRARY[key];
              const selected = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { onChange(key); setOpen(false); setQuery(''); }}
                  title={ICON_LABELS[key] || key}
                  className={`aspect-square flex items-center justify-center rounded-lg border transition ${selected ? 'bg-brand-main text-white border-brand-main' : 'border-border hover:bg-bg-secondary text-txt-primary'}`}
                  data-testid={`icon-option-${key}`}
                >
                  <Icn className="w-4 h-4" />
                </button>
              );
            })}
            {filtered.length === 0 && <div className="col-span-6 text-center text-xs text-txt-secondary py-4">Nenhum ícone</div>}
          </div>
        </div>
      )}
    </div>
  );
}


function FontSizeSlider({ label, value, onChange, min = 8, max = 32, defaultV = 14 }) {
  const v = Number(value || defaultV);
  return (
    <div className="border border-border rounded-lg p-3 bg-bg-secondary/40">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary">{label}</label>
        <span className="text-xs font-mono font-bold">{v}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={v}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-txt-secondary mt-0.5">
        <span>{min}px</span>
        <span style={{ fontSize: `${v}px` }} className="text-txt-primary font-semibold leading-none">Aa</span>
        <span>{max}px</span>
      </div>
    </div>
  );
}

function HeroSlidesEditor({ slides, onChange, uploadImage }) {
  const update = (idx, patch) => onChange(slides.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const remove = (idx) => onChange(slides.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const add = () => onChange([...slides, {
    title: 'Novo banner', subtitle: '', image_url: '',
    cta_label: '', cta_link: '/produtos', overlay_opacity: 0.3,
  }]);

  if (slides.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center" data-testid="hero-empty">
        <p className="text-sm text-txt-secondary mb-3">Nenhum slide configurado.</p>
        <Button variant="outline" onClick={add} data-testid="hero-add-first"><Plus className="w-4 h-4" /> Adicionar primeiro slide</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="hero-slides-list">
      {slides.map((slide, idx) => (
        <div key={idx} className="border border-border rounded-lg p-4 bg-bg-secondary/30" data-testid={`hero-slide-${idx}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="text-xs font-bold uppercase text-txt-secondary">Slide {idx + 1}</div>
            <div className="flex items-center gap-1">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-bg-secondary rounded disabled:opacity-30" title="Mover para cima">↑</button>
              <button onClick={() => move(idx, 1)} disabled={idx === slides.length - 1} className="p-1 hover:bg-bg-secondary rounded disabled:opacity-30" title="Mover para baixo">↓</button>
              <button onClick={() => remove(idx)} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Remover" data-testid={`hero-slide-remove-${idx}`}><X className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="space-y-2">
            <Field label="Título" value={slide.title} onChange={(v) => update(idx, { title: v })} />
            <Field label="Subtítulo" value={slide.subtitle} onChange={(v) => update(idx, { subtitle: v })} />
            <ImageUpload label="Imagem de fundo" url={slide.image_url}
              onPick={async () => {
                const url = await uploadImage(null, true);
                if (url) update(idx, { image_url: url });
              }}
              onClear={() => update(idx, { image_url: '' })}
              testId={`hero-slide-image-${idx}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Texto do botão (CTA)" value={slide.cta_label} onChange={(v) => update(idx, { cta_label: v })} placeholder="Ex: Ver produtos" />
              <Field label="Link do botão" value={slide.cta_link} onChange={(v) => update(idx, { cta_link: v })} placeholder="/produtos" />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Opacidade do overlay</label>
              <input type="range" min="0" max="1" step="0.05" value={slide.overlay_opacity || 0}
                onChange={(e) => update(idx, { overlay_opacity: parseFloat(e.target.value) })}
                className="w-full" />
              <div className="text-xs text-txt-secondary">{Math.round((slide.overlay_opacity || 0) * 100)}%</div>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} data-testid="hero-add"><Plus className="w-4 h-4" /> Adicionar slide</Button>
    </div>
  );
}
