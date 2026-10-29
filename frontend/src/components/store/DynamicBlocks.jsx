import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import ProductCard from './ProductCard';
import TrustBar from './TrustBar';
import { getIcon } from '../../lib/iconLibrary';

/**
 * Renderiza blocos dinamicos definidos no Page Builder.
 * Cada bloco: { id, type, props }
 */
const FULL_WIDTH_TYPES = new Set(['hero', 'hero_carousel', 'trust_bar', 'benefits', 'spacer']);

export default function DynamicBlocks({ blocks }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  return (
    <div className="w-full flex flex-col" data-testid="dynamic-blocks">
      {blocks.map((b) => (
        <BlockRouter key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockRouter({ block }) {
  const t = block.type;
  const p = block.props || {};

  let content = null;
  if (t === 'hero') content = <HeroBlock {...p} />;
  else if (t === 'hero_carousel') content = <HeroCarouselBlock {...p} />;
  else if (t === 'trust_bar' || t === 'benefits') content = <TrustBarBlock {...p} />;
  else if (t === 'spacer') content = <div style={{ height: `${p.height || 40}px` }} />;
  else if (t === 'section_title') content = <SectionTitle {...p} />;
  else if (t === 'rich_text' || t === 'custom_text') content = <RichTextBlock {...p} />;
  else if (t === 'product_grid') content = <ProductGridBlock {...p} />;
  else if (t === 'category_grid') content = <CategoryGridBlock {...p} />;
  else if (t === 'subcategory_grid' || t === 'subcategories') content = <SubcategoryGridBlock {...p} />;
  else if (t === 'column_cards' || t === 'columns') content = <ColumnCardsBlock {...p} />;
  else if (t === 'text') content = <TextBlock {...p} />;
  else if (t === 'image') content = <ImageBlock {...p} />;
  else if (t === 'cta_banner') content = <CtaBanner {...p} />;
  else if (t === 'divider') content = <hr className="border-border my-2" />;
  else if (t === 'html') content = <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: p.html || '' }} />;

  if (!content) return null;

  if (FULL_WIDTH_TYPES.has(t)) {
    return content;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {content}
    </div>
  );
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


  return (
    <section
      className="relative text-white overflow-hidden w-full"
      
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
          <h1 className="font-anona font-bold text-3xl md:text-[2.5rem] leading-tight">{cur.title}</h1>
          {cur.subtitle && <p className="mt-2 sm:mt-4 text-white/95 text-sm sm:text-base md:text-lg max-w-md font-montserrat font-normal leading-relaxed">{cur.subtitle}</p>}
          {cur.cta_label && cur.cta_link && (
            <div className="mt-5 sm:mt-8">
              <Link to={cur.cta_link} className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-montserrat font-semibold text-sm sm:text-base hover:bg-white/90 transition">
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
  return (
    <section className="relative text-white overflow-hidden w-full"  data-testid="hero-block">
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
            <div className="inline-block bg-white/15 backdrop-blur text-[11px] sm:text-xs font-montserrat font-medium px-3.5 py-1.5 rounded-full mb-3 sm:mb-4">
              {tagline}
            </div>
          )}
          <h1 className="font-anona font-bold text-3xl md:text-[2.5rem] leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 sm:mt-4 text-white/95 text-sm sm:text-base md:text-lg max-w-md font-montserrat font-normal leading-relaxed">{subtitle}</p>}
          {cta_label && cta_link && (
            <Link to={cta_link} className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-montserrat font-semibold text-sm sm:text-base mt-5 hover:bg-white/90">
              {cta_label} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle, align = 'left', eyebrow, eyebrow_color, font_family, size }) {
  if (eyebrow || (title && (title.includes('<') || title.includes('&lt;'))) || font_family) {
    return (
      <RichTextBlock
        eyebrow={eyebrow}
        eyebrow_color={eyebrow_color}
        title={title}
        subtitle={subtitle}
        align={align}
        font_family={font_family || 'heading'}
        size={size || '3xl'}
      />
    );
  }
  return (
    <div className={`py-4 ${align === 'center' ? 'text-center mx-auto' : ''}`}>
      {eyebrow && (
        <div
          className="text-xs sm:text-sm uppercase font-montserrat font-bold tracking-[0.25em] mb-2"
          style={{ color: eyebrow_color || 'var(--brand-main, #E8731A)' }}
        >
          {eyebrow}
        </div>
      )}
      <h2 className="font-anona font-bold text-2xl sm:text-3xl md:text-4xl text-txt-primary" dangerouslySetInnerHTML={{ __html: title || '' }} />
      {subtitle && <p className="font-montserrat text-txt-secondary mt-1.5 text-sm sm:text-base">{subtitle}</p>}
    </div>
  );
}

function RichTextBlock({
  eyebrow = '',
  eyebrow_color = '#E8731A',
  title = '',
  html = '',
  subtitle = '',
  font_family = 'serif',
  size = '3xl',
  align = 'center',
}) {
  const content = html || title || '';
  const alignClass = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  }[align] || 'text-center mx-auto';

  const fontClass = {
    serif: 'font-serif',
    heading: 'font-anona font-bold',
    anona: 'font-anona font-bold',
    montserrat: 'font-montserrat font-bold',
    sans: 'font-sans font-bold',
  }[font_family] || 'font-serif';

  const sizeClass = {
    xl: 'text-xl sm:text-2xl',
    '2xl': 'text-2xl sm:text-3xl',
    '3xl': 'text-2xl sm:text-3xl md:text-4xl',
    '4xl': 'text-3xl sm:text-4xl md:text-5xl',
    '5xl': 'text-4xl sm:text-5xl md:text-6xl',
  }[size] || 'text-2xl sm:text-3xl md:text-4xl';

  return (
    <div className={`py-5 sm:py-7 ${alignClass} max-w-4xl`} data-testid="rich-text-block">
      {eyebrow && (
        <div
          className="text-xs sm:text-sm uppercase font-montserrat font-bold tracking-[0.25em] mb-2 sm:mb-2.5"
          style={{ color: eyebrow_color || 'var(--brand-main, #E8731A)' }}
        >
          {eyebrow}
        </div>
      )}

      {content && (
        <h2
          className={`${fontClass} ${sizeClass} text-txt-primary leading-tight tracking-tight`}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}

      {subtitle && (
        <p className="font-montserrat text-txt-secondary text-sm sm:text-base md:text-lg mt-2 sm:mt-3 leading-relaxed max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
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

function CategoryGridBlock({
  selection_mode = 'all',
  selected_ids = [],
  include_all_card = true,
  all_card_label = 'Todos',
  all_card_position = 'start',
  all_card_link = '/produtos',
  limit = 16,
  columns = 8,
  show_all_button = true,
  button_label = 'VER TODOS OS PRODUTOS >',
  button_link = '/produtos',
}) {
  const [cats, setCats] = useState([]);
  const selectedKey = Array.isArray(selected_ids) ? selected_ids.join(',') : '';
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/categories');
        const list = r.categories || r || [];
        if (selection_mode === 'custom' && Array.isArray(selected_ids) && selected_ids.length > 0) {
          const map = new Map(list.map((c) => [c.category_id, c]));
          const filtered = selected_ids.map((id) => map.get(id)).filter(Boolean);
          setCats(filtered);
        } else {
          setCats(limit && Number(limit) > 0 ? list.slice(0, Number(limit)) : list);
        }
      } catch { /* silent */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection_mode, selectedKey, limit]);

  if (!cats.length && !include_all_card) return null;

  const colsClass = {
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
    8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
  }[columns] || 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8';

  const allCardElement = include_all_card !== false ? (
    <Link
      key="__all__"
      to={all_card_link || '/produtos'}
      className="group bg-[#FFF9F5] hover:bg-[#FFF2E8] border border-orange-100/80 hover:border-brand-main/50 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-2.5 min-h-[110px] transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      data-testid="category-card-all"
    >
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-orange-100/70 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-110">
        <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-brand-main stroke-[1.6]" />
      </div>
      <span className="text-xs sm:text-[13px] font-semibold text-txt-primary group-hover:text-brand-main line-clamp-2 leading-tight transition-colors">
        {all_card_label || 'Todos'}
      </span>
    </Link>
  ) : null;

  return (
    <div className="py-6 sm:py-8" data-testid="category-grid-block">
      <div className={`grid ${colsClass} gap-3 sm:gap-4`}>
        {all_card_position !== 'end' && allCardElement}
        {cats.map((c) => {
          const IconComponent = getIcon(c.icon || 'Sparkles');
          const href = c.slug ? `/categoria/${c.slug}` : `/loja?category=${encodeURIComponent(c.name)}`;
          return (
            <Link
              key={c.category_id || c.name}
              to={href}
              className="group bg-[#FFF9F5] hover:bg-[#FFF2E8] border border-orange-100/80 hover:border-brand-main/50 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-2.5 min-h-[110px] transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              data-testid={`category-card-${c.category_id || c.slug}`}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-orange-100/70 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-110">
                {c.icon_svg ? (
                  <img
                    src={c.icon_svg}
                    alt={c.name}
                    className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                  />
                ) : (
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-brand-main stroke-[1.6]" />
                )}
              </div>
              <span className="text-xs sm:text-[13px] font-semibold text-txt-primary group-hover:text-brand-main line-clamp-2 leading-tight transition-colors">
                {c.name}
              </span>
            </Link>
          );
        })}
        {all_card_position === 'end' && allCardElement}
      </div>

      {show_all_button && (
        <div className="mt-8 flex justify-center">
          <Link
            to={button_link || '/produtos'}
            className="inline-flex items-center gap-2 bg-brand-main hover:bg-brand-dark text-white font-montserrat font-bold text-xs sm:text-sm px-8 py-3.5 rounded-full uppercase tracking-wider shadow-sm transition hover:scale-[1.02]"
            data-testid="category-view-all-btn"
          >
            {button_label || 'VER TODOS OS PRODUTOS >'}
          </Link>
        </div>
      )}
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
      <h3 className="font-anona font-bold text-2xl sm:text-3xl">{title}</h3>
      {subtitle && <p className="font-montserrat text-white/90 mt-2 text-sm sm:text-base">{subtitle}</p>}
      {cta_label && cta_link && (
        <Link to={cta_link} className="inline-block mt-4 bg-white text-brand-main px-6 py-3 rounded-lg font-montserrat font-semibold hover:bg-white/90">
          {cta_label}
        </Link>
      )}
    </div>
  );
}
function TrustBarBlock({ items, use_store_settings = true }) {
  return <TrustBar items={items} use_store_settings={use_store_settings} variant="horizontal" />;
}

function SubcategoryGridBlock({
  category_id = '',
  selection_mode = 'all',
  selected_ids = [],
  include_all_card = false,
  all_card_label = 'Todos',
  all_card_position = 'start',
  all_card_link = '/produtos',
  limit = 16,
  columns = 8,
  show_all_button = false,
  button_label = 'VER TODOS OS PRODUTOS >',
  button_link = '/produtos',
}) {
  const [subs, setSubs] = useState([]);
  const selectedKey = Array.isArray(selected_ids) ? selected_ids.join(',') : '';
  useEffect(() => {
    (async () => {
      try {
        const url = (selection_mode !== 'custom' && category_id)
          ? `/api/subcategories?category_id=${encodeURIComponent(category_id)}`
          : '/api/subcategories';
        const r = await api.get(url);
        const list = r.subcategories || r || [];
        if (selection_mode === 'custom' && Array.isArray(selected_ids) && selected_ids.length > 0) {
          const map = new Map(list.map((s) => [s.subcategory_id, s]));
          const filtered = selected_ids.map((id) => map.get(id)).filter(Boolean);
          setSubs(filtered);
        } else {
          setSubs(limit && Number(limit) > 0 ? list.slice(0, Number(limit)) : list);
        }
      } catch { /* silent */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category_id, selection_mode, selectedKey, limit]);

  if (!subs.length && !include_all_card) return null;

  const colsClass = {
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
    8: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
  }[columns] || 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8';

  const allCardElement = include_all_card ? (
    <Link
      key="__all__"
      to={all_card_link || '/produtos'}
      className="group bg-[#FFF9F5] hover:bg-[#FFF2E8] border border-orange-100/80 hover:border-brand-main/50 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-2.5 min-h-[110px] transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      data-testid="subcategory-card-all"
    >
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-orange-100/70 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-110">
        <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-brand-main stroke-[1.6]" />
      </div>
      <span className="text-xs sm:text-[13px] font-semibold text-txt-primary group-hover:text-brand-main line-clamp-2 leading-tight transition-colors">
        {all_card_label || 'Todos'}
      </span>
    </Link>
  ) : null;

  return (
    <div className="py-6 sm:py-8" data-testid="subcategory-grid-block">
      <div className={`grid ${colsClass} gap-3 sm:gap-4`}>
        {all_card_position !== 'end' && allCardElement}
        {subs.map((sc) => {
          const IconComponent = getIcon(sc.icon || 'Sparkles');
          const href = sc.slug ? `/subcategoria/${sc.slug}` : `/loja?subcategory=${encodeURIComponent(sc.name)}`;
          return (
            <Link
              key={sc.subcategory_id || sc.name}
              to={href}
              className="group bg-[#FFF9F5] hover:bg-[#FFF2E8] border border-orange-100/80 hover:border-brand-main/50 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-2.5 min-h-[110px] transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              data-testid={`subcategory-card-${sc.subcategory_id || sc.slug}`}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-orange-100/70 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-110">
                {sc.icon_svg ? (
                  <img
                    src={sc.icon_svg}
                    alt={sc.name}
                    className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                  />
                ) : (
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-brand-main stroke-[1.6]" />
                )}
              </div>
              <span className="text-xs sm:text-[13px] font-semibold text-txt-primary group-hover:text-brand-main line-clamp-2 leading-tight transition-colors">
                {sc.name}
              </span>
            </Link>
          );
        })}
        {all_card_position === 'end' && allCardElement}
      </div>

      {show_all_button && (
        <div className="mt-8 flex justify-center">
          <Link
            to={button_link || '/produtos'}
            className="inline-flex items-center gap-2 bg-brand-main hover:bg-brand-dark text-white font-montserrat font-bold text-xs sm:text-sm px-8 py-3.5 rounded-full uppercase tracking-wider shadow-sm transition hover:scale-[1.02]"
            data-testid="subcategory-view-all-btn"
          >
            {button_label || 'VER TODOS OS PRODUTOS >'}
          </Link>
        </div>
      )}
    </div>
  );
}


function ColumnCardsBlock({
  columns = 5,
  mobile_columns = 1,
  gap = 'medium',
  align = 'left',
  aspect_ratio = 'square',
  image_rounded = '2xl',
  button_style = 'circle_arrow',
  title_font = 'serif',
  title_size = 'xl',
  show_header = false,
  header_eyebrow = '',
  header_title = '',
  header_subtitle = '',
  header_align = 'center',
  items = [],
}) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const isMobile2 = Number(mobile_columns) === 2;
  const numCols = Number(columns) || 5;

  const colsClass = {
    2: isMobile2 ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2',
    3: isMobile2 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: isMobile2 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
    5: isMobile2 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: isMobile2 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  }[numCols] || (isMobile2 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5');

  const gapClass = {
    none: 'gap-0',
    small: 'gap-3 sm:gap-4',
    medium: 'gap-4 sm:gap-5 lg:gap-6',
    large: 'gap-6 sm:gap-8 lg:gap-10',
  }[gap] || 'gap-4 sm:gap-5 lg:gap-6';

  const aspectClass = {
    square: 'aspect-square',
    portrait: 'aspect-[4/5]',
    landscape: 'aspect-[16/9]',
    auto: 'h-auto',
  }[aspect_ratio] || 'aspect-square';

  const roundedClass = {
    '2xl': 'rounded-2xl sm:rounded-3xl',
    xl: 'rounded-xl sm:rounded-2xl',
    lg: 'rounded-lg sm:rounded-xl',
    none: 'rounded-none',
  }[image_rounded] || 'rounded-2xl sm:rounded-3xl';

  const fontClass = {
    serif: 'font-serif',
    anona: 'font-anona font-bold',
    montserrat: 'font-montserrat font-bold',
    sans: 'font-sans font-semibold',
  }[title_font] || 'font-serif';

  const sizeClass = {
    lg: 'text-base sm:text-lg',
    xl: 'text-lg sm:text-xl md:text-[22px]',
    '2xl': 'text-xl sm:text-2xl',
  }[title_size] || 'text-lg sm:text-xl md:text-[22px]';

  const isCenter = align === 'center';

  return (
    <div className="py-8 sm:py-12" data-testid="column-cards-block">
      {/* Cabeçalho opcional do bloco */}
      {show_header && (header_title || header_eyebrow) && (
        <div className={`mb-8 sm:mb-12 ${header_align === 'left' ? 'text-left' : 'text-center mx-auto max-w-3xl'}`}>
          {header_eyebrow && (
            <div className="font-montserrat font-bold text-xs sm:text-sm uppercase tracking-[0.25em] text-brand-main mb-2 sm:mb-3">
              {header_eyebrow}
            </div>
          )}
          {header_title && (
            <h2
              className="font-serif text-2xl sm:text-3xl md:text-4xl text-txt-primary leading-tight"
              dangerouslySetInnerHTML={{ __html: header_title }}
            />
          )}
          {header_subtitle && (
            <p className="font-montserrat text-txt-secondary text-sm sm:text-base mt-2.5 leading-relaxed">
              {header_subtitle}
            </p>
          )}
        </div>
      )}

      {/* Grid de Colunas */}
      <div className={`grid ${colsClass} ${gapClass}`}>
        {items.map((it, idx) => {
          const href = it.link || '/loja';
          return (
            <div
              key={idx}
              className={`group flex flex-col h-full ${isCenter ? 'items-center text-center' : 'items-start text-left'}`}
              data-testid={`column-card-${idx}`}
            >
              {/* Imagem */}
              <Link
                to={href}
                className={`relative w-full ${aspectClass} ${roundedClass} overflow-hidden bg-[#FAF2EB] block transition-shadow duration-300 group-hover:shadow-lg`}
              >
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.title || ''}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-brand-main/60 p-4">
                    <ImageIcon className="w-10 h-10 stroke-[1.5] mb-2 opacity-60" />
                    <span className="text-[11px] font-montserrat text-txt-secondary">Sem imagem</span>
                  </div>
                )}
              </Link>

              {/* Textos */}
              <div className={`mt-4 sm:mt-5 flex flex-col flex-1 w-full ${isCenter ? 'items-center' : 'items-start'}`}>
                {it.title && (
                  <Link to={href} className="group-hover:text-brand-main transition-colors">
                    <h3 className={`${fontClass} ${sizeClass} text-txt-primary leading-snug`}>
                      {it.title}
                    </h3>
                  </Link>
                )}

                {it.description && (
                  <p className="mt-2 text-xs sm:text-sm text-txt-secondary leading-relaxed font-montserrat font-normal flex-1">
                    {it.description}
                  </p>
                )}

                {/* Botão de Ação */}
                {button_style !== 'none' && (
                  <div className="mt-4 sm:mt-5">
                    {button_style === 'circle_arrow' && (
                      <Link
                        to={href}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-orange-200/90 group-hover:border-brand-main bg-white/70 group-hover:bg-brand-main text-brand-main group-hover:text-white flex items-center justify-center transition-all duration-200 shadow-2xs group-hover:shadow-sm"
                        aria-label={it.title || 'Ver mais'}
                      >
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    )}

                    {button_style === 'text_arrow' && (
                      <Link
                        to={href}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-montserrat font-semibold text-brand-main hover:text-brand-dark transition-colors"
                      >
                        <span>{it.button_label || 'Saiba mais'}</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    )}

                    {button_style === 'solid' && (
                      <Link
                        to={href}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-brand-main hover:bg-brand-dark text-white text-xs sm:text-sm font-montserrat font-semibold transition-all shadow-2xs hover:shadow"
                      >
                        {it.button_label || 'Ver mais'}
                      </Link>
                    )}

                    {button_style === 'outline' && (
                      <Link
                        to={href}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-brand-main/70 text-brand-main hover:bg-brand-main hover:text-white text-xs sm:text-sm font-montserrat font-semibold transition-all"
                      >
                        {it.button_label || 'Ver mais'}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
