import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileEdit, Loader2, PlusCircle, Trash2, Eye, ArrowLeft, Save, Copy, Check,
  Globe, Layers, Palette, Box, Settings, Sparkles, HelpCircle, Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';
import { optimizeImageFile } from '../../lib/imageOptimizer';
import { CMS_FONTS_CSS, CMS_STYLE_MANAGER_SECTORS, registerCmsBlocks } from '../../lib/cmsEditorConfig';

import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import gjsBlocksBasic from 'grapesjs-blocks-basic';

// ============== LISTA DE PÁGINAS ==============
export function AdminPagesList() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try { const r = await api.get('/api/admin/pages'); setPages(r.pages || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const slug = prompt('Slug da nova página (ex: sobre, termos, politicas):');
    if (!slug) return;
    const title = prompt('Título da página:', slug) || slug;
    try {
      const p = await api.post('/api/admin/pages', { slug, title });
      toast.success('Página criada');
      navigate(`/backoffice/paginas/${p.page_id}`);
    } catch (e) { toast.error(e?.message); }
  };

  const del = async (p) => {
    if (!window.confirm(`Deletar a página "${p.title}"?`)) return;
    try { await api.del(`/api/admin/pages/${p.page_id}`); toast.success('Deletada'); load(); }
    catch (e) { toast.error(e?.message); }
  };

  return (
    <div data-testid="admin-pages">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-black text-2xl flex items-center gap-3">
            <FileEdit className="w-7 h-7 text-brand-main" /> Páginas Informativas (CMS)
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Crie e edite páginas institucionais (Quem Somos, Políticas, Prazos, Termos) com blocos modernos, fontes oficiais e editor visual.
          </p>
        </div>
        <Button onClick={create} data-testid="create-page-btn"><PlusCircle className="w-4 h-4" /> Nova página</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> :
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Título</th>
                <th className="text-left p-3">URL</th>
                <th className="text-center p-3">Status</th>
                <th className="text-left p-3">Atualização</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-txt-secondary">Nenhuma página ainda. Clique em "Nova página".</td></tr>}
              {pages.map(p => (
                <tr key={p.page_id} className="border-t border-border">
                  <td className="p-3 font-semibold">{p.title}</td>
                  <td className="p-3 font-mono text-xs text-brand-main">/p/{p.slug}</td>
                  <td className="p-3 text-center">{p.published ? <Badge variant="success">Publicada</Badge> : <Badge variant="warning">Rascunho</Badge>}</td>
                  <td className="p-3 text-xs text-txt-secondary">{formatDateTime(p.updated_at)}</td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-bg-secondary rounded hover:bg-border font-medium">
                      <Eye className="w-3.5 h-3.5 text-txt-secondary" /> Ver
                    </a>
                    <button onClick={() => navigate(`/backoffice/paginas/${p.page_id}`)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-brand-main text-white rounded hover:bg-brand-hover font-semibold" data-testid={`edit-${p.slug}`}>
                      <FileEdit className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={() => del(p)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100" title="Excluir página">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}

// ============== EDITOR VISUAL GRAPESJS AVANÇADO ==============
export function AdminPageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const initializedIdRef = useRef(null);
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSeoModal, setShowSeoModal] = useState(false);
  const [activeTab, setActiveTab] = useState('blocks'); // blocks | styles | layers | traits

  // Carregar a página
  useEffect(() => {
    (async () => {
      try {
        const p = await api.get(`/api/admin/pages/${id}`);
        setPage(p);
      } catch (e) { toast.error(e?.message); navigate('/backoffice/paginas'); }
      finally { setLoading(false); }
    })();
  }, [id, navigate]);

  // Inicializar GrapesJS apenas uma vez para este id de página
  useEffect(() => {
    if (!page || !containerRef.current || initializedIdRef.current === page.page_id) return;
    initializedIdRef.current = page.page_id;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: 'calc(100vh - 170px)',
      width: 'auto',
      storageManager: false,
      plugins: [gjsPresetWebpage, gjsBlocksBasic],
      pluginsOpts: {
        [gjsPresetWebpage]: {
          modalImportTitle: 'Importar HTML',
          modalImportLabel: 'Cole seu código HTML/CSS aqui',
        },
        [gjsBlocksBasic]: {
          flexGrid: true,
        },
      },
      canvas: {
        styles: [
          'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
          'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Inter:wght@400;500;600;700&display=swap',
        ],
      },
      styleManager: {
        sectors: CMS_STYLE_MANAGER_SECTORS,
      },
      assetManager: {
        upload: true,
        uploadText: 'Arraste imagens ou clique para fazer upload',
        addBtnText: 'Adicionar por URL',
        uploadFile: async (e) => {
          const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
          for (const file of Array.from(files || [])) {
            try {
              const opt = await optimizeImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });
              editor.AssetManager.add(opt.dataUrl);
              toast.success(`Foto "${file.name}" otimizada e pronta para uso!`);
            } catch (err) {
              toast.error('Erro ao processar imagem: ' + err.message);
            }
          }
        },
      },
      deviceManager: {
        devices: [
          { name: 'Desktop', width: '' },
          { name: 'Tablet', width: '768px', widthMedia: '992px' },
          { name: 'Mobile', width: '375px', widthMedia: '480px' },
        ],
      },
    });

    // Registra a biblioteca completa de blocos informativos OxxPharma
    registerCmsBlocks(editor);

    // Carregar conteúdo pré-existente
    if (page.components_json) {
      try {
        const pData = typeof page.components_json === 'string'
          ? JSON.parse(page.components_json)
          : page.components_json;
        if (pData && (pData.pages || pData.components)) {
          editor.loadProjectData(pData);
        } else {
          editor.setComponents(page.html || '');
          editor.setStyle(page.css || '');
        }
      } catch {
        editor.setComponents(page.html || '');
        editor.setStyle(page.css || '');
      }
    } else {
      editor.setComponents(page.html || '<div class="cms-container" style="max-width: 1100px; margin: 0 auto; padding: 40px 20px;"><h1 style="font-family: \'Anona\', sans-serif; font-size: 38px; font-weight: 800; color: #1E293B; margin-bottom: 16px;">Nova página informativa</h1><p style="font-family: \'IBM Plex Sans\', sans-serif; font-size: 16px; color: #64748B; line-height: 1.8;">Utilize a barra lateral direita para arrastar novos blocos de conteúdo, títulos, colunas, imagens e botões.</p></div>');
      editor.setStyle(page.css || '');
    }

    // Injeta CSS com as fontes no canvas iframe
    editor.on('load', () => {
      try {
        const doc = editor.Canvas.getDocument();
        if (doc && doc.head) {
          const style = doc.createElement('style');
          style.setAttribute('data-oxx-cms-fonts', 'true');
          style.innerHTML = CMS_FONTS_CSS;
          doc.head.appendChild(style);
        }
      } catch (err) {
        console.warn('Erro ao injetar fontes no canvas:', err);
      }
    });

    editorRef.current = editor;

    return () => {
      try { editor.destroy(); } catch {}
      editorRef.current = null;
      initializedIdRef.current = null;
    };
  }, [id, page?.page_id]);

  const save = useCallback(async (publishOverride) => {
    if (!editorRef.current || !page) return;
    setSaving(true);
    try {
      const html = editorRef.current.getHtml() || '';
      const css = editorRef.current.getCss() || '';
      let components_json = null;
      try {
        components_json = editorRef.current.getProjectData();
      } catch (err) {
        console.warn('Erro ao obter projectData:', err);
      }

      // Garante que isPublished seja estritamente booleano (evita capturar o evento de clique do React)
      const isPublished = typeof publishOverride === 'boolean'
        ? publishOverride
        : Boolean(page.published);

      const updated = await api.put(`/api/admin/pages/${id}`, {
        title: page.title || '',
        slug: page.slug || '',
        html,
        css,
        components_json,
        published: isPublished,
        meta_description: page.meta_description || '',
      });
      if (updated) {
        setPage(prev => ({
          ...prev,
          ...updated,
          title: updated.title || prev.title,
          slug: updated.slug || prev.slug,
          published: updated.published !== undefined ? updated.published : isPublished,
        }));
      }
      toast.success('Página salva com sucesso!');
    } catch (e) {
      toast.error(e?.message || 'Erro ao salvar página');
    } finally {
      setSaving(false);
    }
  }, [id, page]);

  // Atalho de teclado Ctrl+S / Cmd+S para salvar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  const publishToggle = () => {
    const nextPublished = !page.published;
    setPage(p => ({ ...p, published: nextPublished }));
    save(nextPublished);
  };

  const copyUrl = () => {
    const url = `${window.location.origin}/p/${page.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const switchView = (viewName) => {
    if (!editorRef.current) return;
    setActiveTab(viewName);
    try {
      const pnm = editorRef.current.Panels;
      const cmdMap = {
        blocks: 'open-blocks',
        styles: 'open-sm',
        layers: 'open-layers',
        traits: 'open-tm',
      };
      const cmd = cmdMap[viewName];
      if (cmd) {
        const btn = pnm.getButton('views', cmd);
        if (btn) {
          btn.set('active', true);
        } else {
          editorRef.current.runCommand(cmd);
        }
      }
    } catch (e) {}
  };

  if (loading || !page) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-page-editor" className="space-y-3 pb-8">
      {/* Barra superior de controle */}
      <div className="bg-white border border-border rounded-xl p-3 shadow-2xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate('/backoffice/paginas')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>

          {/* Título da página */}
          <div className="flex items-center gap-1.5 border-b-2 border-orange-500/80 px-1 py-0.5">
            <input
              value={page.title}
              onChange={(e) => setPage(p => ({ ...p, title: e.target.value }))}
              placeholder="Título da página..."
              className="font-heading font-black text-lg md:text-xl bg-transparent outline-none text-txt-primary min-w-[200px]"
              title="Clique para editar o título da página"
            />
          </div>

          {/* Slug / Link permanente */}
          <div className="flex items-center gap-1 text-xs bg-bg-secondary px-2.5 py-1 rounded-lg border border-border">
            <span className="text-txt-secondary font-mono">/p/</span>
            <input
              value={page.slug}
              onChange={(e) => setPage(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-') }))}
              className="font-mono font-bold text-brand-main bg-transparent outline-none w-32 md:w-40"
              title="URL da página"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="p-1 text-txt-secondary hover:text-brand-main rounded transition-colors ml-1"
              title="Copiar link completo da página"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Atalhos rápidos para alternar painéis GrapesJS */}
        <div className="hidden lg:flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
          <button
            type="button"
            onClick={() => switchView('blocks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'blocks' ? 'bg-white text-orange-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Box className="w-3.5 h-3.5" /> Blocos
          </button>
          <button
            type="button"
            onClick={() => switchView('styles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'styles' ? 'bg-white text-orange-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Estilos
          </button>
          <button
            type="button"
            onClick={() => switchView('layers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'layers' ? 'bg-white text-orange-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Camadas
          </button>
          <button
            type="button"
            onClick={() => switchView('traits')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'traits' ? 'bg-white text-orange-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Configs
          </button>
        </div>

        {/* Ações da página */}
        <div className="flex items-center gap-2">
          {/* SEO Modal Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSeoModal(true)}
            title="Configurar Meta Descrição e SEO"
            className="text-xs text-txt-secondary hover:text-brand-main"
          >
            <Globe className="w-3.5 h-3.5 mr-1" /> SEO
          </Button>

          {/* Toggle Publicar / Rascunho */}
          <button
            type="button"
            onClick={publishToggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              page.published
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            data-testid="publish-toggle-btn"
          >
            <span className={`w-2 h-2 rounded-full ${page.published ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {page.published ? 'Publicada' : 'Rascunho'}
          </button>

          {/* Pré-visualizar na Loja */}
          <a
            href={`/p/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-bg-secondary text-txt-primary transition-colors"
            data-testid="preview-page-btn"
          >
            <Eye className="w-3.5 h-3.5 text-txt-secondary" /> Pré-visualizar
          </a>

          {/* Salvar */}
          <Button onClick={() => save()} disabled={saving} data-testid="save-page-btn" className="shadow-xs">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Editor GrapesJS Container */}
      <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden admin-cms-editor-wrapper">
        <div ref={containerRef} />
      </div>

      {/* Dica de atalhos e informações */}
      <div className="flex items-center justify-between text-xs text-txt-secondary px-2">
        <div className="flex items-center gap-2">
          <span>💡 Dica: Arraste blocos da aba <b>Blocos</b> para a tela.</span>
          <span>•</span>
          <span>Selecione qualquer elemento para alterar fontes, cores de texto e tamanhos na aba <b>Estilos</b>.</span>
        </div>
        <div className="font-mono text-[11px] text-gray-400">
          Atalho: <kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 text-gray-700 font-sans">Ctrl</kbd> + <kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 text-gray-700 font-sans">S</kbd> para salvar
        </div>
      </div>

      {/* Modal simples de SEO / Meta Descrição */}
      {showSeoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowSeoModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-heading font-black text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-brand-main" /> Otimização para Busca (SEO)
              </h3>
              <button onClick={() => setShowSeoModal(false)} className="text-txt-secondary hover:text-txt-primary">✕</button>
            </div>
            <div>
              <label className="text-xs font-bold text-txt-secondary block mb-1">Título da Página (Meta Title)</label>
              <input
                value={page.title || ''}
                onChange={e => setPage(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-txt-secondary block mb-1">Descrição para o Google (Meta Description)</label>
              <textarea
                value={page.meta_description || ''}
                onChange={e => setPage(p => ({ ...p, meta_description: e.target.value }))}
                placeholder="Breve resumo da página informativa exibido nos resultados de busca do Google..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none"
              />
              <span className="text-[11px] text-txt-secondary">Recomendado: entre 120 e 160 caracteres.</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowSeoModal(false)}>Fechar</Button>
              <Button size="sm" onClick={() => { setShowSeoModal(false); save(); }}>Salvar SEO</Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles para o GrapesJS UI */}
      <style>{`
        .admin-cms-editor-wrapper .gjs-cv-canvas {
          background-color: #f1f5f9;
        }
        .admin-cms-editor-wrapper .gjs-block-category .gjs-title {
          font-family: 'Anona', sans-serif !important;
          font-weight: 700 !important;
          letter-spacing: 0.5px !important;
          background: #334155 !important;
          color: #f8fafc !important;
          border-bottom: 1px solid #475569 !important;
        }
        .admin-cms-editor-wrapper .gjs-block {
          border-radius: 8px !important;
          transition: all 0.2s ease !important;
        }
        .admin-cms-editor-wrapper .gjs-block:hover {
          color: #e8731a !important;
          border-color: #e8731a !important;
          box-shadow: 0 4px 10px rgba(232, 115, 26, 0.15) !important;
        }
        .admin-cms-editor-wrapper .gjs-pn-btn.gjs-pn-active {
          color: #e8731a !important;
        }
        .admin-cms-editor-wrapper .gjs-sm-sector .gjs-sm-title {
          font-weight: 700 !important;
          color: #f8fafc !important;
          background: #1e293b !important;
        }
      `}</style>
    </div>
  );
}
