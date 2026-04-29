import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FileEdit, Loader2, PlusCircle, Trash2, Eye, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';

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
    const slug = prompt('Slug da nova página (ex: sobre, termos):');
    if (!slug) return;
    const title = prompt('Título da página:', slug) || slug;
    try {
      const p = await api.post('/api/admin/pages', { slug, title });
      toast.success('Página criada');
      navigate(`/backoffice/paginas/${p.page_id}`);
    } catch (e) { toast.error(e?.message); }
  };

  const del = async (p) => {
    if (!confirm(`Deletar a página "${p.title}"?`)) return;
    try { await api.del(`/api/admin/pages/${p.page_id}`); toast.success('Deletada'); load(); }
    catch (e) { toast.error(e?.message); }
  };

  return (
    <div data-testid="admin-pages">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading font-black text-2xl flex items-center gap-3">
            <FileEdit className="w-7 h-7 text-brand-main" /> Páginas (Editor visual)
          </h1>
          <p className="text-sm text-txt-secondary mt-1">Crie páginas customizadas (Sobre, Termos, etc.) com editor drag &amp; drop.</p>
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
                  <td className="p-3 font-mono text-xs">/p/{p.slug}</td>
                  <td className="p-3 text-center">{p.published ? <Badge variant="success">Publicada</Badge> : <Badge variant="warning">Rascunho</Badge>}</td>
                  <td className="p-3 text-xs text-txt-secondary">{formatDateTime(p.updated_at)}</td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-bg-secondary rounded hover:bg-border"><Eye className="w-3 h-3" /> Ver</a>
                    <button onClick={() => navigate(`/backoffice/paginas/${p.page_id}`)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-brand-main text-white rounded hover:bg-brand-hover" data-testid={`edit-${p.slug}`}><FileEdit className="w-3 h-3" /> Editar</button>
                    <button onClick={() => del(p)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"><Trash2 className="w-3 h-3" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}

// ============== EDITOR VISUAL GRAPESJS ==============
export function AdminPageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Inicializar GrapesJS
  useEffect(() => {
    if (!page || !containerRef.current || editorRef.current) return;
    const editor = grapesjs.init({
      container: containerRef.current,
      height: 'calc(100vh - 200px)',
      width: 'auto',
      storageManager: false,
      plugins: [gjsPresetWebpage, gjsBlocksBasic],
      pluginsOpts: {
        [gjsPresetWebpage]: {
          modalImportTitle: 'Importar HTML',
          modalImportLabel: 'Cole seu HTML/CSS aqui',
        },
        [gjsBlocksBasic]: { flexGrid: true },
      },
      canvas: {
        styles: ['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'],
      },
      deviceManager: {
        devices: [
          { name: 'Desktop', width: '' },
          { name: 'Tablet', width: '768px', widthMedia: '992px' },
          { name: 'Mobile', width: '375px', widthMedia: '480px' },
        ],
      },
    });

    // Carregar conteúdo
    if (page.components_json) {
      try { editor.loadProjectData(page.components_json); }
      catch { editor.setComponents(page.html || ''); editor.setStyle(page.css || ''); }
    } else {
      editor.setComponents(page.html || '<div><h1>Nova página</h1></div>');
      editor.setStyle(page.css || '');
    }
    editorRef.current = editor;

    return () => {
      try { editor.destroy(); } catch {}
      editorRef.current = null;
    };
  }, [page]);

  const save = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      const components_json = editorRef.current.getProjectData();
      const updated = await api.put(`/api/admin/pages/${id}`, {
        title: page.title, slug: page.slug, html, css, components_json,
        published: page.published, meta_description: page.meta_description,
      });
      setPage(updated);
      toast.success('Página salva!');
    } catch (e) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  const publishToggle = () => setPage(p => ({ ...p, published: !p.published }));

  if (loading || !page) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-page-editor">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/backoffice/paginas')}><ArrowLeft className="w-4 h-4" /> Voltar</Button>
          <input value={page.title} onChange={(e) => setPage(p => ({ ...p, title: e.target.value }))}
            className="font-heading font-black text-xl border-b border-transparent hover:border-border focus:border-brand-main bg-transparent outline-none" />
          <span className="text-xs text-txt-secondary">/p/<input value={page.slug} onChange={(e) => setPage(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} className="font-mono bg-transparent border-b border-transparent hover:border-border focus:border-brand-main outline-none" /></span>
        </div>
        <div className="flex gap-2 items-center">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!page.published} onChange={publishToggle} className="w-4 h-4 accent-brand-main" data-testid="publish-toggle" />
            <span className="font-semibold">{page.published ? 'Publicada' : 'Rascunho'}</span>
          </label>
          <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><Eye className="w-4 h-4" /> Pré-visualizar</Button>
          </a>
          <Button onClick={save} disabled={saving} data-testid="save-page-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </Button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div ref={containerRef} />
      </div>
    </div>
  );
}
