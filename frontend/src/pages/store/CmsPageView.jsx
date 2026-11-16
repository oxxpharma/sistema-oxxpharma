import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Loader2, ArrowLeft } from 'lucide-react';
import SEOHead from '../../components/SEOHead';

export default function CmsPageView() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.get(`/api/pages/${slug}`);
        setPage(p);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-main" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center p-6">
        <div>
          <div className="text-6xl mb-4">😕</div>
          <h1 className="font-heading font-black text-2xl mb-2 text-txt-primary">Página não encontrada</h1>
          <p className="text-sm text-txt-secondary mb-6">A página informativa "/p/{slug}" não existe ou ainda está em rascunho.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-main text-white font-semibold rounded-xl text-sm hover:bg-brand-hover shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cms-page-wrapper min-h-[60vh] pb-16" data-testid="cms-page">
      <SEOHead
        title={`${page.title} | OxxPharma Magistral`}
        description={page.meta_description || page.title}
        canonical={`/p/${page.slug}`}
      />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <style>{`
        .cms-content {
          font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1e293b;
          line-height: 1.6;
        }
        .cms-content * {
          box-sizing: border-box;
        }
        .cms-content img {
          max-width: 100%;
          height: auto;
        }
        .cms-content .font-anona {
          font-family: 'Anona', sans-serif !important;
        }
        .cms-content .font-tosh {
          font-family: 'Tosh A', Georgia, serif !important;
        }
        .cms-content .font-montserrat {
          font-family: 'Montserrat', sans-serif !important;
        }
        .cms-content .font-plex {
          font-family: 'IBM Plex Sans', sans-serif !important;
        }
        ${page.css || ''}
      `}</style>
      <div className="cms-content" dangerouslySetInnerHTML={{ __html: page.html || '' }} />
    </div>
  );
}
