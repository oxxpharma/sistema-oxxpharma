import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowRight } from 'lucide-react';
import ProductCard from './ProductCard';

/**
 * Renderiza blocos dinamicos definidos no Page Builder.
 * Cada bloco: { id, type, props }
 */
export default function DynamicBlocks({ blocks }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  return (
    <div className="space-y-12" data-testid="dynamic-blocks">
      {blocks.map((b) => (
        <BlockRouter key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockRouter({ block }) {
  const t = block.type;
  const p = block.props || {};
  if (t === 'hero') return <HeroBlock {...p} />;
  if (t === 'hero_carousel') return <HeroCarouselBlock {...p} />;
  if (t === 'section_title') return <SectionTitle {...p} />;
  if (t === 'product_grid') return <ProductGridBlock {...p} />;
  if (t === 'category_grid') return <CategoryGridBlock {...p} />;
  if (t === 'text') return <TextBlock {...p} />;
  if (t === 'image') return <ImageBlock {...p} />;
  if (t === 'cta_banner') return <CtaBanner {...p} />;
  if (t === 'divider') return <hr className="border-border my-8" />;
  if (t === 'spacer') return <div style={{ height: `${p.height || 40}px` }} />;
  if (t === 'html') return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: p.html || '' }} />;
  return null;
}

function HeroCarouselBlock({ slides = [], autoplay_seconds = 6, show_dots = true }) {
  const [idx, setIdx] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (!count || !autoplay_seconds || autoplay_seconds <= 0) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), autoplay_seconds * 1000);
    return () => clearInterval(t);
  }, [count, autoplay_seconds]);

  if (!count) return null;
  const cur = slides[Math.min(idx, count - 1)] || slides[0];
  const overlay = cur.overlay_opacity ?? 0.4;

  return (
    <section
      className="relative rounded-2xl overflow-hidden text-white min-h-[280px] sm:min-h-[360px] flex items-center transition-[background] duration-700"
      style={{
        background: cur.image_url
          ? `linear-gradient(135deg, rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${cur.image_url}") center/cover`
          : 'linear-gradient(135deg, var(--brand-main, #E8731A), #C25500)',
      }}
      data-testid="hero-carousel"
    >
      <div className="px-6 sm:px-10 py-10 sm:py-16 max-w-2xl">
        <h1 className="font-heading font-black text-2xl sm:text-4xl md:text-5xl leading-tight">{cur.title}</h1>
        {cur.subtitle && <p className="mt-2 sm:mt-4 text-white/90 text-sm sm:text-base md:text-lg max-w-md">{cur.subtitle}</p>}
        {cur.cta_label && cur.cta_link && (
          <Link to={cur.cta_link} className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-bold text-sm sm:text-base mt-5 hover:bg-white/90">
            {cur.cta_label} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {show_dots && count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2" data-testid="hero-carousel-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir para slide ${i + 1}`}
              className={`w-2 h-2 rounded-full transition ${i === idx ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroBlock({ title, subtitle, cta_label, cta_link, image_url, tagline, overlay_opacity = 0.4 }) {
  return (
    <section
      className="relative rounded-2xl overflow-hidden text-white min-h-[280px] sm:min-h-[360px] flex items-center"
      style={{
        background: image_url
          ? `linear-gradient(135deg, rgba(0,0,0,${overlay_opacity}), rgba(0,0,0,${overlay_opacity})), url("${image_url}") center/cover`
          : 'linear-gradient(135deg, var(--brand-main, #E8731A), #C25500)',
      }}
    >
      <div className="px-6 sm:px-10 py-10 sm:py-16 max-w-2xl">
        {tagline && (
          <div className="inline-block bg-white/15 backdrop-blur text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-full mb-3 sm:mb-4">
            {tagline}
          </div>
        )}
        <h1 className="font-heading font-black text-2xl sm:text-4xl md:text-5xl leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 sm:mt-4 text-white/90 text-sm sm:text-base md:text-lg max-w-md">{subtitle}</p>}
        {cta_label && cta_link && (
          <Link to={cta_link} className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-bold text-sm sm:text-base mt-5 hover:bg-white/90">
            {cta_label} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle, align = 'left' }) {
  return (
    <div className={`${align === 'center' ? 'text-center' : ''}`}>
      <h2 className="font-heading font-black text-2xl sm:text-3xl">{title}</h2>
      {subtitle && <p className="text-txt-secondary mt-1 text-sm sm:text-base">{subtitle}</p>}
    </div>
  );
}

function ProductGridBlock({ source = 'featured', category, product_ids, limit = 8, columns = 4 }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ source, limit: String(limit) });
        if (category) params.append('category', category);
        if (product_ids) params.append('product_ids', product_ids);
        const r = await api.get(`/api/pages/_resolve/product-list?${params}`);
        setProducts(r.products || []);
      } catch { /* silent */ } finally { setLoading(false); }
    })();
  }, [source, category, product_ids, limit]);

  if (loading) return <div className="py-8 text-center text-txt-secondary text-sm">Carregando produtos...</div>;
  if (!products.length) return <div className="py-8 text-center text-txt-secondary text-sm">Sem produtos.</div>;
  const colsClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  }[columns] || 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 ${colsClass} gap-4`}>
      {products.map((p) => <ProductCard key={p.product_id} product={p} />)}
    </div>
  );
}

function CategoryGridBlock({ limit = 6 }) {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/categories');
        setCats((r.categories || r || []).slice(0, limit));
      } catch { /* silent */ }
    })();
  }, [limit]);
  if (!cats.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cats.map((c) => (
        <Link
          key={c.category_id || c.name}
          to={`/loja?category=${encodeURIComponent(c.name)}`}
          className="bg-white border border-border rounded-xl p-4 text-center hover:border-brand-main hover:shadow-md transition"
        >
          {c.image && <img src={c.image} alt={c.name} className="w-16 h-16 object-contain mx-auto mb-2" />}
          <div className="font-bold text-sm">{c.name}</div>
        </Link>
      ))}
    </div>
  );
}

function TextBlock({ html, align = 'left' }) {
  return (
    <div className={`prose max-w-none ${align === 'center' ? 'text-center mx-auto' : ''}`} dangerouslySetInnerHTML={{ __html: html || '' }} />
  );
}

function ImageBlock({ src, alt, link }) {
  if (!src) return null;
  const img = <img src={src} alt={alt || ''} className="w-full h-auto rounded-xl" />;
  return link ? <Link to={link}>{img}</Link> : img;
}

function CtaBanner({ title, subtitle, cta_label, cta_link, bg_color }) {
  return (
    <div
      className="rounded-2xl p-8 text-center text-white"
      style={{ background: bg_color || 'linear-gradient(135deg, var(--brand-main, #E8731A), #C25500)' }}
    >
      <h3 className="font-heading font-black text-2xl sm:text-3xl">{title}</h3>
      {subtitle && <p className="text-white/90 mt-2 text-sm sm:text-base">{subtitle}</p>}
      {cta_label && cta_link && (
        <Link to={cta_link} className="inline-block mt-4 bg-white text-brand-main px-6 py-3 rounded-lg font-bold hover:bg-white/90">
          {cta_label}
        </Link>
      )}
    </div>
  );
}
