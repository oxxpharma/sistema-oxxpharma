import React from 'react';
import { Input, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import { Wand2, Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Componente reutilizável de Campos de SEO com Pré-visualização em Tempo Real do Google (Google SERP Snippet Preview)
 * e botão de Gerador Automático de tags.
 */
export default function SEOFormFields({
  values = {},
  onChange,
  onAutoGenerate,
  baseUrl = 'https://oxxpharma.com.br',
  defaultType = 'produto',
}) {
  const slug = values.slug || '';
  const title = values.seo_title || '';
  const description = values.seo_description || '';
  const keywords = values.seo_keywords || '';
  const canonical = values.canonical_url || '';

  const titleLength = title.length;
  const descLength = description.length;

  const getTitleStatus = () => {
    if (titleLength === 0) return { color: 'text-gray-400', label: 'Recomendado de 30 a 60 caracteres' };
    if (titleLength < 30) return { color: 'text-amber-600', label: 'Um pouco curto (recomendado 30-60)' };
    if (titleLength <= 60) return { color: 'text-emerald-600 font-semibold', label: 'Tamanho ideal para o Google' };
    return { color: 'text-rose-600 font-semibold', label: 'Pode ser cortado no Google (> 60 caracteres)' };
  };

  const getDescStatus = () => {
    if (descLength === 0) return { color: 'text-gray-400', label: 'Recomendado de 70 a 160 caracteres' };
    if (descLength < 70) return { color: 'text-amber-600', label: 'Um pouco curta (recomendado 70-160)' };
    if (descLength <= 160) return { color: 'text-emerald-600 font-semibold', label: 'Tamanho ideal para o Google' };
    return { color: 'text-rose-600 font-semibold', label: 'Pode ser cortada no Google (> 160 caracteres)' };
  };

  const titleStatus = getTitleStatus();
  const descStatus = getDescStatus();

  const previewTitle = title || values.name || 'Título da página no Google';
  const previewSlug = slug || (values.name ? values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'url-pagina');
  const previewDesc = description || values.description || 'Esta é a descrição amigável que os usuários verão quando pesquisarem por este item no Google.';
  const previewUrl = `${baseUrl}/${defaultType}/${previewSlug}`;

  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-6" data-testid="seo-form-fields">
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border pb-4">
        <div>
          <h3 className="font-heading font-black text-lg text-txt-primary flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-main" />
            Otimização para Busca (SEO & Google)
          </h3>
          <p className="text-xs text-txt-secondary mt-0.5">
            Configure títulos, descrições e URLs amigáveis para melhorar o posicionamento do site no Google.
          </p>
        </div>
        {onAutoGenerate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onAutoGenerate();
              toast.success('Campos de SEO preenchidos automaticamente!');
            }}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            data-testid="auto-generate-seo-btn"
          >
            <Wand2 className="w-4 h-4 mr-1.5" />
            Gerar SEO automático
          </Button>
        )}
      </div>

      {/* Google SERP Preview Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          Pré-visualização do Resultado no Google (SERP Preview)
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 font-sans max-w-2xl">
          {/* Breadcrumb Header */}
          <div className="flex items-center gap-2 text-xs text-[#202124] mb-1 truncate">
            <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
              O
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#202124]">OxxPharma</span>
              <span className="text-[11px] text-[#5f6368] truncate">{previewUrl}</span>
            </div>
          </div>
          {/* Title Link */}
          <h4 className="text-[#1a0dab] hover:underline text-lg font-normal leading-tight mb-1 cursor-pointer truncate">
            {previewTitle} | OxxPharma
          </h4>
          {/* Description Snippet */}
          <p className="text-xs text-[#4d5156] leading-snug line-clamp-2">
            {previewDesc}
          </p>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Slug / URL Amigável"
            value={slug}
            onChange={(e) => onChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-/]+/g, ''))}
            placeholder="ex: shampoo-antiqueda-oxx-250ml"
            hint={`Caminho da página no navegador: ${previewUrl}`}
            data-testid="seo-slug-input"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-txt-secondary uppercase">Título SEO (Meta Title)</label>
            <span className={`text-xs ${titleStatus.color}`}>
              {titleLength}/60 chars ({titleStatus.label})
            </span>
          </div>
          <Input
            value={title}
            onChange={(e) => onChange('seo_title', e.target.value)}
            placeholder="Título destacado que aparecerá nos resultados do Google"
            data-testid="seo-title-input"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-txt-secondary uppercase">Descrição SEO (Meta Description)</label>
            <span className={`text-xs ${descStatus.color}`}>
              {descLength}/160 chars ({descStatus.label})
            </span>
          </div>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => onChange('seo_description', e.target.value)}
            placeholder="Resumo atraente do produto/categoria que encoraja o usuário a clicar no link"
            data-testid="seo-description-input"
          />
        </div>

        <div>
          <Input
            label="Palavras-Chave (Keywords)"
            value={keywords}
            onChange={(e) => onChange('seo_keywords', e.target.value)}
            placeholder="ex: oxxpharma, shampoo, cosmeticos, cuidados"
            hint="Separe os termos por vírgula"
            data-testid="seo-keywords-input"
          />
        </div>

        <div>
          <Input
            label="URL Canônica (Canonical URL)"
            value={canonical}
            onChange={(e) => onChange('canonical_url', e.target.value)}
            placeholder="https://oxxpharma.com.br/pagina-principal"
            hint="Opcional. Preencha se esta página for uma variação de outra URL original."
            data-testid="seo-canonical-input"
          />
        </div>
      </div>
    </div>
  );
}
