import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { refreshSiteSettings } from '../../hooks/useSiteSettings';
import { Button } from '../../components/ui/Button';
import { Loader2, Save, Image as ImageIcon, Palette, Layout, Megaphone, Trash2, PlusCircle, Upload, BadgeCheck, Gift, Truck } from 'lucide-react';
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

  const load = async () => {
    try { setS(await api.get('/api/site-settings')); } finally { setLoading(false); }
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

  const uploadImage = async (key) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files?.[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast.error('Imagem muito grande (max 2MB)'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const r = await api.post('/api/admin/upload-image', { data: reader.result, name: file.name });
          set(key, r.url);
          toast.success('Imagem enviada');
        } catch (e) { toast.error(e?.message); }
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  };

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
          <Card title="Banner principal (homepage)">
            <Field label="Título" value={s.hero_title} onChange={(v) => set('hero_title', v)} testId="hero-title" />
            <Field label="Subtítulo" value={s.hero_subtitle} onChange={(v) => set('hero_subtitle', v)} />
            <ImageUpload label="Imagem de fundo" url={s.hero_image_url} onPick={() => uploadImage('hero_image_url')} onClear={() => set('hero_image_url', '')} testId="hero-image" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Texto do botão (CTA)" value={s.hero_cta_label} onChange={(v) => set('hero_cta_label', v)} />
              <Field label="Link do botão" value={s.hero_cta_link} onChange={(v) => set('hero_cta_link', v)} placeholder="/produtos" />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Opacidade do overlay (0 = imagem nítida, 1 = preto total)</label>
              <input type="range" min="0" max="1" step="0.05" value={s.hero_overlay_opacity || 0} onChange={(e) => set('hero_overlay_opacity', parseFloat(e.target.value))} className="w-full" />
              <div className="text-xs text-txt-secondary">{Math.round((s.hero_overlay_opacity || 0) * 100)}%</div>
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
        <div className="space-y-4 max-w-2xl">
          <Card title="Configuração de Frete Grátis">
            <p className="text-xs text-txt-secondary -mt-1 mb-3">Quando ativo, sobrepõe o cálculo dos Correios e zera o frete na vitrine, no carrinho e no checkout.</p>
            <div className="space-y-3">
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${s.free_shipping_mode === 'off' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="fs_mode" checked={s.free_shipping_mode === 'off'} onChange={() => set('free_shipping_mode', 'off')} className="mt-1" data-testid="fs-off" />
                <div>
                  <div className="font-bold text-sm">Desativado</div>
                  <div className="text-xs text-txt-secondary">Frete calculado normalmente pelos Correios.</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${s.free_shipping_mode === 'all' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="fs_mode" checked={s.free_shipping_mode === 'all'} onChange={() => set('free_shipping_mode', 'all')} className="mt-1" data-testid="fs-all" />
                <div>
                  <div className="font-bold text-sm">Frete grátis para tudo</div>
                  <div className="text-xs text-txt-secondary">Toda compra terá frete zero, independente do valor.</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 border-2 rounded-lg p-3 cursor-pointer ${s.free_shipping_mode === 'above' ? 'border-brand-main bg-brand-light' : 'border-border'}`}>
                <input type="radio" name="fs_mode" checked={s.free_shipping_mode === 'above'} onChange={() => set('free_shipping_mode', 'above')} className="mt-1" data-testid="fs-above" />
                <div className="flex-1">
                  <div className="font-bold text-sm">Frete grátis acima de um valor</div>
                  <div className="text-xs text-txt-secondary mb-2">Aplica frete zero quando o subtotal atingir o valor mínimo.</div>
                  {s.free_shipping_mode === 'above' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                      <div>
                        <label className="text-xs font-semibold block mb-1">Valor mínimo (R$)</label>
                        <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono" value={s.free_shipping_min_subtotal || 0} onChange={(e) => set('free_shipping_min_subtotal', parseFloat(e.target.value) || 0)} data-testid="fs-min" />
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <Field label="Texto exibido na opção (ex: Frete grátis)" value={s.free_shipping_label} onChange={(v) => set('free_shipping_label', v)} testId="fs-label" />
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
