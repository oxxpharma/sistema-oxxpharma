import React from 'react';
import { Eye, X } from 'lucide-react';

/**
 * Iter 43.5: Banner fixo no topo quando o usuario esta visualizando o site
 * como outra marca (modo preview via ?as_tenant=).
 */
export default function TenantPreviewBanner() {
  const [previewTenant, setPreviewTenant] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('as_tenant');
    if (fromUrl) {
      sessionStorage.setItem('preview_tenant', fromUrl);
      setPreviewTenant(fromUrl);
    } else {
      const fromSession = sessionStorage.getItem('preview_tenant');
      if (fromSession) setPreviewTenant(fromSession);
    }
  }, []);

  if (!previewTenant) return null;

  const exit = () => {
    sessionStorage.removeItem('preview_tenant');
    // Remove ?as_tenant da URL se estiver presente
    const url = new URL(window.location.href);
    url.searchParams.delete('as_tenant');
    window.location.href = url.pathname + url.search;
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-500 text-amber-950 rounded-full shadow-lg px-4 py-2 flex items-center gap-3 text-sm font-bold"
      data-testid="tenant-preview-banner"
    >
      <Eye className="w-4 h-4" />
      <span>Visualizando como <strong className="uppercase">{previewTenant}</strong></span>
      <button onClick={exit} className="ml-2 hover:bg-amber-400 rounded-full p-1" title="Sair do preview">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
