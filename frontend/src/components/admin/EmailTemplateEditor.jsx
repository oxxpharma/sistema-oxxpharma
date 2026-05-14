import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {
  Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Heading1, Heading2, List, ListOrdered, Quote, Minus, Image as ImageIcon,
  Link2, Code, Undo2, Redo2, Type, AlignLeft, Variable,
} from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const VARIABLES = [
  { key: 'user.name', label: 'Nome do usuário' },
  { key: 'user.email', label: 'Email do usuário' },
  { key: 'order_short_id', label: 'Nº do pedido' },
  { key: 'order.total', label: 'Total do pedido' },
  { key: 'order_link', label: 'Link do pedido' },
  { key: 'customer_name', label: 'Nome do cliente' },
  { key: 'referral_link', label: 'Link de indicação' },
  { key: 'referral_code', label: 'Código de indicação' },
  { key: 'commission.amount', label: 'Valor do cashback' },
  { key: 'candidate.name', label: 'Nome do candidato' },
];

/**
 * Editor rico para templates de email com toolbar e variáveis dinâmicas.
 *
 * Props:
 *  - value: string HTML
 *  - onChange: (html: string) => void
 *  - logoUrl: URL da logo do site (vinda das settings)
 */
export default function EmailTemplateEditor({ value, onChange, logoUrl }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        HTMLAttributes: { class: 'mx-auto block max-w-full h-auto rounded' },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand-main underline' } }),
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[280px] focus:outline-none px-4 py-3',
      },
    },
  });

  // Sincroniza quando `value` muda externamente (ex: reset do form)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="border border-border rounded p-4 text-sm text-txt-secondary">Carregando editor...</div>;

  const insertImageByUrl = () => {
    const url = window.prompt('URL da imagem:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const insertLogo = () => {
    if (!logoUrl) {
      toast.error('Logo da empresa não configurada em Aparência');
      return;
    }
    editor.chain().focus().setImage({ src: logoUrl, alt: 'Logo' }).run();
  };

  const uploadImage = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post('/api/admin/upload-image', fd);
      if (r?.url) {
        editor.chain().focus().setImage({ src: r.url }).run();
        toast.success('Imagem inserida');
      }
    } catch (e) {
      toast.error('Falha no upload: ' + (e.message || e));
    }
  };

  const insertLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL do link:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertVariable = (key) => {
    editor.chain().focus().insertContent(`{{${key}}}`).run();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white" data-testid="email-tiptap-editor">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-2 bg-bg-secondary border-b border-border">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={BoldIcon} title="Negrito" />
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={ItalicIcon} title="Itálico" />
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} icon={UnderlineIcon} title="Tachado" />
        <Divider />
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} title="Título 1" />
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading2} title="Título 2" />
        <ToolBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} icon={Type} title="Parágrafo" />
        <Divider />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} title="Lista" />
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} title="Lista numerada" />
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} icon={Quote} title="Citação" />
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} icon={Code} title="Bloco de código" />
        <Divider />
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} title="Divisor (linha horizontal)" />
        <ToolBtn onClick={insertLink} active={editor.isActive('link')} icon={Link2} title="Link" />
        <label className="cursor-pointer p-1.5 rounded hover:bg-white" title="Inserir imagem (upload)">
          <ImageIcon className="w-4 h-4" />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
        </label>
        <ToolBtn onClick={insertImageByUrl} icon={AlignLeft} title="Inserir imagem (URL)" />
        {logoUrl && <ToolBtn onClick={insertLogo} icon={ImageIcon} title="Inserir logo da empresa" />}
        <Divider />
        {/* Dropdown de variáveis */}
        <details className="relative">
          <summary className="cursor-pointer list-none p-1.5 rounded hover:bg-white flex items-center gap-1 text-xs font-semibold" title="Inserir variável">
            <Variable className="w-4 h-4" /> Variável
          </summary>
          <div className="absolute top-full left-0 z-10 mt-1 bg-white rounded-lg border border-border shadow-lg w-64 max-h-72 overflow-y-auto">
            {VARIABLES.map(v => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-bg-secondary border-b border-border last:border-0 flex items-center justify-between"
              >
                <span className="font-mono text-brand-main">{`{{${v.key}}}`}</span>
                <span className="text-txt-secondary">{v.label}</span>
              </button>
            ))}
          </div>
        </details>
        <Divider />
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} icon={Undo2} title="Desfazer" />
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} icon={Redo2} title="Refazer" />
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolBtn({ onClick, active, icon: Icon, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-white transition ${active ? 'bg-white text-brand-main shadow-sm' : 'text-txt-secondary'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}
