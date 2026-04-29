import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Loader2 } from 'lucide-react';

export default function CmsPageView() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try { setPage(await api.get(`/api/pages/${slug}`)); }
      catch { setError(true); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  useEffect(() => {
    if (page?.title) document.title = `${page.title} - OxxPharma`;
  }, [page]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-main" /></div>;
  if (error || !page) return (
    <div className="min-h-[60vh] flex items-center justify-center text-center">
      <div>
        <div className="text-6xl mb-4">😕</div>
        <h1 className="font-heading font-black text-2xl mb-2">Página não encontrada</h1>
        <p className="text-sm text-txt-secondary">/p/{slug}</p>
      </div>
    </div>
  );

  return (
    <div className="cms-page-wrapper" data-testid="cms-page">
      {page.css && <style>{page.css}</style>}
      <div dangerouslySetInnerHTML={{ __html: page.html || '' }} />
    </div>
  );
}
