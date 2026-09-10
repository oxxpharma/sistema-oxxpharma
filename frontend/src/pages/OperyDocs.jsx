import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, ExternalLink, Copy, Check } from 'lucide-react';

export default function OperyDocs() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/opery/docs-spec')
      .then(r => r.json())
      .then(d => setContent(d.content || '# Documentação indisponível'))
      .catch(() => setContent('# Erro ao carregar documentação'))
      .finally(() => setLoading(false));
  }, []);

  const base = window.location.origin;
  const copyBase = async () => {
    await navigator.clipboard.writeText(base);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="opery-docs-page">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-orange-300 font-bold mb-1">OxxPharma API</div>
              <h1 className="font-heading font-black text-4xl">Integração Opery Solutions</h1>
              <p className="text-slate-300 mt-2 max-w-2xl text-sm">
                Documentação técnica para integrar o ERP Opery com o e-commerce OxxPharma. Bidirecional: envio de vendas presenciais e recebimento de pedidos online para emissão de NF-e.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Base URL</div>
              <button onClick={copyBase} className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-slate-100 hover:bg-slate-700">
                {base}
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : (
          <article className="prose-opery">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-6 pb-10 pt-6 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <div>OxxPharma · Integração Opery · v1.0</div>
        <a href="mailto:integracao@oxxpharma.com" className="inline-flex items-center gap-1 hover:text-orange-600">
          Suporte técnico <ExternalLink className="w-3 h-3" />
        </a>
      </footer>

      <style>{`
        .prose-opery { color: #0f172a; line-height: 1.7; font-size: 15px; }
        .prose-opery h1 { font-size: 30px; font-weight: 900; margin-top: 36px; margin-bottom: 12px; letter-spacing: -0.02em; }
        .prose-opery h2 { font-size: 22px; font-weight: 900; margin-top: 32px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #fed7aa; color: #9a3412; }
        .prose-opery h3 { font-size: 17px; font-weight: 800; margin-top: 24px; margin-bottom: 8px; color: #1e293b; }
        .prose-opery h4 { font-size: 15px; font-weight: 800; margin-top: 16px; margin-bottom: 6px; color: #475569; }
        .prose-opery p { margin: 10px 0; }
        .prose-opery a { color: #ea580c; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
        .prose-opery code { background: #f1f5f9; color: #be123c; padding: 2px 6px; border-radius: 4px; font-size: 12.5px; font-family: 'Menlo', 'Monaco', monospace; }
        .prose-opery pre { background: #0f172a; color: #f1f5f9; padding: 16px; border-radius: 10px; overflow-x: auto; font-size: 12.5px; line-height: 1.55; margin: 14px 0; }
        .prose-opery pre code { background: transparent; color: inherit; padding: 0; }
        .prose-opery ul, .prose-opery ol { padding-left: 24px; margin: 10px 0; }
        .prose-opery li { margin: 4px 0; }
        .prose-opery table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
        .prose-opery th { text-align: left; background: #fff7ed; color: #9a3412; padding: 8px 12px; border-bottom: 2px solid #fed7aa; font-weight: 700; }
        .prose-opery td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        .prose-opery blockquote { border-left: 3px solid #f97316; background: #fff7ed; padding: 8px 14px; margin: 12px 0; color: #7c2d12; border-radius: 0 8px 8px 0; }
        .prose-opery hr { margin: 30px 0; border: 0; border-top: 1px dashed #cbd5e1; }
        .prose-opery input[type="checkbox"] { margin-right: 6px; }
      `}</style>
    </div>
  );
}
