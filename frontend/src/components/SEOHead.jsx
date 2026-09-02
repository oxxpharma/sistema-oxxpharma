import { useEffect } from 'react';

/**
 * Iter 62 (SEO): manipula tags de <head> em SPA sem depender de react-helmet.
 * Preenche title, description, canonical, Open Graph e JSON-LD.
 *
 * Uso:
 *   <SEOHead title="..." description="..." canonical="/categoria/xyz"
 *            image="..." type="website" jsonLd={{...}} />
 */
export default function SEOHead({ title, description, canonical, image, type = 'website', jsonLd = null }) {
  useEffect(() => {
    const original = { title: document.title };

    if (title) document.title = title;

    const upsertMeta = (attr, key, value) => {
      if (value === undefined || value === null || value === '') return null;
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', String(value));
      return el;
    };

    const upsertLink = (rel, href) => {
      if (!href) return null;
      let el = document.head.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
      return el;
    };

    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:image', image);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    if (image) upsertMeta('name', 'twitter:image', image);

    if (canonical) {
      const abs = canonical.startsWith('http') ? canonical : `${window.location.origin}${canonical}`;
      upsertLink('canonical', abs);
      upsertMeta('property', 'og:url', abs);
    }

    // JSON-LD (Schema.org)
    let ldEl = null;
    if (jsonLd) {
      ldEl = document.createElement('script');
      ldEl.type = 'application/ld+json';
      ldEl.textContent = JSON.stringify(jsonLd);
      ldEl.dataset.seohead = '1';
      document.head.appendChild(ldEl);
    }

    return () => {
      document.title = original.title;
      if (ldEl && ldEl.parentNode) ldEl.parentNode.removeChild(ldEl);
    };
  }, [title, description, canonical, image, type, jsonLd]);

  return null;
}
