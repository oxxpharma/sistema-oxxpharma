import { useEffect } from 'react';
import { useSiteSettings } from '../../hooks/useSiteSettings';

/**
 * BrandHead - aplica favicon dinâmico, título da aba e theme-color
 * baseado no site_settings (sem renderizar nada no DOM).
 */
export default function BrandHead() {
  const s = useSiteSettings();

  useEffect(() => {
    if (!s) return;
    const head = document.head;
    const storeName = (s.store_name || 'OxxPharma').trim();
    const faviconUrl = (s.favicon_url || '').trim();
    const primary = (s.brand_primary_color || '').trim();

    // 1. Title
    if (storeName) {
      // mantém sufixo se a página atual já setou um título (ex: produto/categoria)
      const cur = document.title || '';
      if (!cur || cur === 'OxxPharma' || cur.endsWith(' - OxxPharma') || cur === storeName) {
        document.title = storeName;
      }
    }

    // 2. Favicon - remove TODOS os <link rel*="icon"> e adiciona o novo
    if (faviconUrl) {
      const oldIcons = head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
      oldIcons.forEach(el => el.parentNode && el.parentNode.removeChild(el));

      // cache-bust simples: adiciona ?v= timestamp
      const busted = faviconUrl + (faviconUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();

      // detecta tipo
      let type = 'image/png';
      const lower = faviconUrl.toLowerCase();
      if (lower.endsWith('.ico') || lower.startsWith('data:image/x-icon') || lower.startsWith('data:image/vnd.microsoft.icon')) type = 'image/x-icon';
      else if (lower.endsWith('.svg') || lower.startsWith('data:image/svg')) type = 'image/svg+xml';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.startsWith('data:image/jpeg')) type = 'image/jpeg';
      else if (lower.endsWith('.webp') || lower.startsWith('data:image/webp')) type = 'image/webp';

      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = type;
      link.href = busted;
      head.appendChild(link);

      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = busted;
      head.appendChild(apple);
    }

    // 3. Theme color
    if (primary) {
      let meta = head.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        head.appendChild(meta);
      }
      meta.content = primary;
    }
  }, [s]);

  return null;
}
