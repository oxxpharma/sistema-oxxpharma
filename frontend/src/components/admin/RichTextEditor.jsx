import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Link2, Undo2, Redo2, RemoveFormatting,
} from 'lucide-react';

/**
 * Editor de texto rico reutilizavel (TipTap) — Iter 61.
 *
 * Props:
 *  - value: string HTML
 *  - onChange: (html) => void
 *  - minHeight: altura minima em px (default 320)
 *  - placeholder: texto de dica
 */
export default function RichTextEditor({ value, onChange, minHeight = 320, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-brand-main underline' },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange && onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-3',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && value !== undefined) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="border border-border-primary rounded-lg p-4 text-sm text-fg-secondary">Carregando editor...</div>;
  }

  const insertLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL:', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const btn = (active, onClick, Icon, title, testId) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      data-testid={testId}
      className={`p-1.5 rounded transition ${active ? 'bg-brand-main/15 text-brand-main' : 'hover:bg-bg-secondary text-fg-secondary'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="border border-border-primary rounded-lg bg-bg-primary overflow-hidden focus-within:ring-2 focus-within:ring-brand-main/30">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border-primary bg-bg-secondary/50">
        {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), Bold, 'Negrito (Ctrl+B)', 'rte-bold')}
        {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), Italic, 'Itálico (Ctrl+I)', 'rte-italic')}
        {btn(editor.isActive('underline'), () => editor.chain().focus().toggleMark && editor.chain().focus().toggleMark('underline').run(), Underline, 'Sublinhado (Ctrl+U)', 'rte-underline')}
        {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), Strikethrough, 'Tachado', 'rte-strike')}
        <div className="w-px h-5 bg-border-primary mx-1" />
        {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, 'Título grande', 'rte-h1')}
        {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, 'Subtítulo', 'rte-h2')}
        {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3, 'Título 3', 'rte-h3')}
        <div className="w-px h-5 bg-border-primary mx-1" />
        {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), List, 'Lista com marcadores', 'rte-ul')}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, 'Lista numerada', 'rte-ol')}
        {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), Quote, 'Citação', 'rte-quote')}
        <div className="w-px h-5 bg-border-primary mx-1" />
        {btn(editor.isActive('link'), insertLink, Link2, 'Inserir/editar link', 'rte-link')}
        {btn(false, () => editor.chain().focus().unsetAllMarks().clearNodes().run(), RemoveFormatting, 'Limpar formatação', 'rte-clear')}
        <div className="ml-auto flex gap-0.5">
          {btn(false, () => editor.chain().focus().undo().run(), Undo2, 'Desfazer', 'rte-undo')}
          {btn(false, () => editor.chain().focus().redo().run(), Redo2, 'Refazer', 'rte-redo')}
        </div>
      </div>
      <div style={{ minHeight }} className="text-sm text-fg-primary">
        <EditorContent editor={editor} />
      </div>
      {placeholder && !editor.getText() && (
        <div className="pointer-events-none px-4 -mt-[280px] text-fg-secondary/60 text-sm">{placeholder}</div>
      )}
    </div>
  );
}
