import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const total = slides.length;
  const interval = Math.max(0, Number(autoplay_seconds ?? 6)) * 1000;

  const next = useCallback(() => setIdx((i) => (i + 1) % Math.max(1, total)), [total]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % Math.max(1, total)), [total]);

  useEffect(() => {
    if (total <= 1 || interval === 0) return;
    const t = setInterval(next, interval);
    return () => clearInterval(t);
  }, [total, interval, next]);

  if (!total) return null;
  const cur = slides[Math.min(idx, total - 1)] || {};
  const overlay = Number(cur.overlay_opacity ?? 0.4);
  // Break-out do container pai (max-w-7xl) para 100% da viewport
  const breakout = { width: '100vw', marginLeft: 'calc(-50vw + 50%)' };

  return (
    <section
      className="relative text-white overflow-hidden"
      style={breakout}
      data-testid="hero-carousel"
      data-current-slide={idx}
    >
      {/* Fundos com fade entre slides */}
      <div className="absolute inset-0">
        {slides.map((sl, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700"
            style={
              sl.image_url
                ? {
                    opacity: i === idx ? 1 : 0,
                    backgroundImage: `url("${sl.image_url}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {
                    opacity: i === idx ? 1 : 0,
                    background: 'linear-gradient(135deg, var(--brand-main, #E8731A), #C25500)',
                  }
            }
          />
        ))}
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 md:py-20 min-h-[280px] sm:min-h-[360px] md:min-h-[440px] flex items-center">
        <div className="max-w-2xl w-full">
          <h1 className="font-heading font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight">{cur.title}</h1>
          {cur.subtitle && <p className="mt-2 sm:mt-4 text-white/90 text-sm sm:text-base md:text-lg max-w-md">{cur.subtitle}</p>}
          {cur.cta_label && cur.cta_link && (
            <div className="mt-5 sm:mt-8">
              <Link to={cur.cta_link} className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-bold text-sm sm:text-base hover:bg-white/90 transition">
                {cur.cta_label} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {total > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center transition" aria-label="Slide anterior" data-testid="hero-carousel-prev">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button onClick={next} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center transition" aria-label="Próximo slide" data-testid="hero-carousel-next">
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </>
      )}

      {total > 1 && show_dots && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" data-testid="hero-carousel-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir para slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === idx ? 'bg-white w-8' : 'bg-white/40 w-2 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroBlock({ title, subtitle, cta_label, cta_link, image_url, tagline, overlay_opacity = 0.4 }) {
  const breakout = { width: '100vw', marginLeft: 'calc(-50vw + 50%)' };
  return (
    <section className="relative text-white overflow-hidden" style={breakout} data-testid="hero-block">
      <div
        className="absolute inset-0"
        style={
          image_url
            ? { backgroundImage: `url("${image_url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'linear-gradient(135deg, var(--brand-main, #E8731A), #C25500)' }
        }
      />
      {image_url && <div className="absolute inset-0 bg-black" style={{ opacity: overlay_opacity }} />}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 md:py-20 min-h-[280px] sm:min-h-[360px] md:min-h-[440px] flex items-center">
        <div className="max-w-2xl w-full">
          {tagline && (
            <div className="inline-block bg-white/15 backdrop-blur text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-full mb-3 sm:mb-4">
              {tagline}
            </div>
          )}
          <h1 className="font-heading font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 sm:mt-4 text-white/90 text-sm sm:text-base md:text-lg max-w-md">{subtitle}</p>}
          {cta_label && cta_link && (
            <Link to={cta_link} className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-bold text-sm sm:text-base mt-5 hover:bg-white/90">
              {cta_label} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
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
