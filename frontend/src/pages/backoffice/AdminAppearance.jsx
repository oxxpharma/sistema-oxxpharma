import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Loader2, Save, Image as ImageIcon, Palette, Layout, Megaphone, Trash2, PlusCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';

const TABS = [
  { key: 'identity', label: 'Identidade', icon: Palette },
  { key: 'hero', label: 'Banner principal', icon: Layout },
  { key: 'announcement', label: 'Barra de aviso', icon: Megaphone },
  { key: 'footer', label: 'Rodapé', icon: Layout },
];

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
function Field({ label, value, onChange, type = 'text', placeholder, testId }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1">{label}</label>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-brand-main"
        data-testid={testId} />
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
