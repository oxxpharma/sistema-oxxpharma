import React, { useEffect, useState, useCallback, useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Hero carrossel - exibe um ou mais slides com autoplay.
 *
 * Props:
 *  - slides: [{title, subtitle, image_url, cta_label, cta_link, overlay_opacity}]
 *  - settings: site settings (autoplay_seconds, show_dots, tagline)
 */
function toCssDim(val, fallback = undefined) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return `${val}px`;
  const str = String(val).trim();
  if (/^-?[\d.]+$/.test(str)) return `${str}px`;
  return str;
}

function resolveBannerHeights(p = {}) {
  const deskMinMap = {
    compact: '360px',
    normal: '440px',
    large: '560px',
    screen: '72vh',
  };
  const deskMin = p.banner_height === 'custom'
    ? toCssDim(p.banner_min_height_custom, '440px')
    : deskMinMap[p.banner_height] || '440px';

  let deskMax = null;
  if (p.banner_max_height_type === 'custom' || p.banner_max_height_custom) {
    deskMax = toCssDim(p.banner_max_height_custom || p.max_height_px);
  } else if (p.banner_max_height_type && p.banner_max_height_type !== 'none') {
    deskMax = p.banner_max_height_type;
  } else if (p.max_height_px || p.hero_max_height_px) {
    deskMax = `${p.max_height_px || p.hero_max_height_px}px`;
  }

  const mobMinMap = {
    compact: '240px',
    normal: '320px',
    large: '420px',
    screen: '85vh',
  };
  let mobMin;
  if (p.banner_mobile_dimensions_enabled) {
    mobMin = p.banner_height_mobile === 'custom'
      ? toCssDim(p.banner_min_height_mobile_custom, '320px')
      : mobMinMap[p.banner_height_mobile] || '320px';
  } else {
    const fallbackMobMap = {
      compact: '240px',
      normal: '280px',
      large: '340px',
      screen: '400px',
    };
    mobMin = p.banner_height === 'custom'
      ? toCssDim(p.banner_min_height_custom, '280px')
      : fallbackMobMap[p.banner_height] || '280px';
  }

  let mobMax = null;
  if (p.banner_mobile_dimensions_enabled) {
    if (p.banner_max_height_mobile_type === 'custom' || p.banner_max_height_mobile_custom) {
      mobMax = toCssDim(p.banner_max_height_mobile_custom || p.max_height_mobile_px);
    } else if (p.banner_max_height_mobile_type && p.banner_max_height_mobile_type !== 'none') {
      mobMax = p.banner_max_height_mobile_type;
    } else if (p.max_height_mobile_px) {
      mobMax = `${p.max_height_mobile_px}px`;
    }
  } else {
    mobMax = deskMax;
  }

  return { deskMin, deskMax, mobMin, mobMax };
}

function formatAspectRatio(val, fallback = '1920 / 575') {
  if (!val) return fallback;
  const str = String(val).trim();
  if (str === 'same') return fallback;
  if (str.includes('/')) return str;
  if (str.includes(':')) return str.replace(':', ' / ');
  if (str.includes('x') || str.includes('X')) return str.replace(/x/i, ' / ');
  if (/^[\d.]+$/.test(str)) return str;
  return fallback;
}

function resolveBannerSizing(p = {}) {
  // Proporções solicitadas: Desktop 1920x575, Mobile 1080x834
  const isAspectRatio = p.banner_sizing_mode !== 'fixed_height';
  const ratioDesktop = formatAspectRatio(p.aspect_ratio_desktop, '1920 / 575');
  const ratioMobile = formatAspectRatio(
    p.aspect_ratio_mobile === 'same' ? ratioDesktop : p.aspect_ratio_mobile,
    '1080 / 834'
  );
  const maxWidth = p.max_container_width && p.max_container_width !== 'none' ? p.max_container_width : null;

  const heights = resolveBannerHeights(p);
  return {
    isAspectRatio,
    ratioDesktop,
    ratioMobile,
    maxWidth,
    ...heights,
  };
}

export default function HeroCarousel({ slides = [], settings }) {
  const hookId = useId();
  const carouselClass = 'hc-' + hookId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cfg = settings || {};
  const [idx, setIdx] = useState(0);
  const total = slides.length;
  const interval = Math.max(0, Number(cfg.hero_autoplay_seconds ?? 6)) * 1000;
  const showDots = cfg.hero_show_dots !== false;

  const next = useCallback(() => setIdx((i) => (i + 1) % Math.max(1, total)), [total]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % Math.max(1, total)), [total]);

  useEffect(() => {
    if (total <= 1 || interval === 0) return;
    const id = setInterval(next, interval);
    return () => clearInterval(id);
  }, [total, interval, next]);

  if (total === 0) return null;
  const slide = slides[idx] || {};
  const overlay = Number(slide.overlay_opacity ?? 0.4);

  const sizing = resolveBannerSizing({ ...cfg, ...slide });
  const isAspect = sizing.isAspectRatio;
  const ratioDesk = formatAspectRatio(sizing.ratioDesktop, '1920 / 575');
  const ratioMob = formatAspectRatio(sizing.ratioMobile, '1080 / 834');
  const maxW = sizing.maxWidth && sizing.maxWidth !== 'none' ? sizing.maxWidth : null;

  return (
    <section
      className={`relative text-white overflow-hidden w-full ${carouselClass}`}
      data-testid="hero-carousel"
      data-current-slide={idx}
    >
      <style>{`
        ${isAspect ? `
          .${carouselClass} {
            width: 100%;
            aspect-ratio: ${ratioMob};
            height: auto;
            min-height: unset;
            max-height: none;
            ${maxW ? `max-width: ${maxW}; margin-left: auto; margin-right: auto;` : ''}
          }
          .${carouselClass} .hc-inner {
            height: 100%;
            min-height: 100%;
            box-sizing: border-box;
          }
          @media (min-width: 768px) {
            .${carouselClass} {
              aspect-ratio: ${ratioDesk};
              height: auto;
              min-height: unset;
              max-height: none;
            }
            .${carouselClass} .hc-inner {
              height: 100%;
              min-height: 100%;
            }
          }
        ` : `
          .${carouselClass} {
            min-height: ${sizing.mobMin};
            ${sizing.mobMax ? `max-height: ${sizing.mobMax};` : ''}
          }
          .${carouselClass} .hc-inner {
            min-height: ${sizing.mobMin};
            ${sizing.mobMax ? `max-height: ${sizing.mobMax};` : ''}
          }
          @media (min-width: 768px) {
            .${carouselClass} {
              min-height: ${sizing.deskMin};
              ${sizing.deskMax ? `max-height: ${sizing.deskMax};` : ''}
            }
            .${carouselClass} .hc-inner {
              min-height: ${sizing.deskMin};
              ${sizing.deskMax ? `max-height: ${sizing.deskMax};` : ''}
            }
          }
        `}
      `}</style>

      {/* Imagem de fundo com transicao suave */}
      <div className="absolute inset-0">
        {slides.map((sl, i) => (
          <React.Fragment key={i}>
            <div
              className={`absolute inset-0 transition-opacity duration-700 ${sl.image_url_mobile ? 'hidden md:block' : ''}`}
              style={
                sl.image_url
                  ? {
                      opacity: i === idx ? 1 : 0,
                      backgroundImage: `url("${sl.image_url}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }
                  : {
                      opacity: i === idx ? 1 : 0,
                      background: 'linear-gradient(135deg, var(--brand-main, #E8731A), #C25500)',
                    }
              }
            />
            {sl.image_url_mobile && (
              <div
                className="absolute inset-0 transition-opacity duration-700 md:hidden"
                style={{
                  opacity: i === idx ? 1 : 0,
                  backgroundImage: `url("${sl.image_url_mobile}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            )}
          </React.Fragment>
        ))}
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
      </div>

      {slide.cta_link && !slide.cta_label && (
        <Link to={slide.cta_link} className="absolute inset-0 z-10" aria-label={slide.title || 'Slide'} />
      )}

      <div className="hc-inner relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-10 flex items-center">
        <div className="fade-in max-w-2xl w-full">
          {cfg.tagline && (
            <div className="inline-block bg-white/15 backdrop-blur text-[11px] sm:text-xs font-montserrat font-medium px-3.5 py-1.5 rounded-full mb-3 sm:mb-4">
              {cfg.tagline}
            </div>
          )}
          <h1 className="font-anona font-bold text-3xl md:text-[2.5rem] leading-tight" data-testid="hero-title">
            {slide.title || 'Saúde e bem-estar na sua porta.'}
          </h1>
          {slide.subtitle && (
            <p className="mt-2 sm:mt-4 text-white/95 text-sm sm:text-base md:text-lg max-w-md font-montserrat font-normal leading-relaxed" data-testid="hero-subtitle">
              {slide.subtitle}
            </p>
          )}
          {slide.cta_label && slide.cta_link && (
            <>
              {Boolean(slide.cta_custom_margins_mobile) ? (
                <>
                  {/* Desktop */}
                  <div
                    className={`hidden md:flex w-full ${
                      slide.cta_align === 'center'
                        ? 'justify-center text-center'
                        : slide.cta_align === 'right'
                        ? 'justify-end text-right'
                        : 'justify-start text-left'
                    } ${Boolean(slide.cta_custom_margins || slide.cta_margin_top === 'custom') ? '' : 'mt-5 sm:mt-8'}`}
                  >
                    <Link
                      to={slide.cta_link}
                      style={
                        Boolean(slide.cta_custom_margins || slide.cta_margin_top === 'custom')
                          ? {
                              marginTop: toCssDim(slide.cta_margin_top_desktop ?? slide.cta_margin_top_px, '32px'),
                              marginBottom: toCssDim(slide.cta_margin_bottom_desktop ?? slide.cta_margin_bottom_px, '0px'),
                              marginLeft: toCssDim(slide.cta_margin_left_desktop ?? slide.cta_margin_left_px, '0px'),
                              marginRight: toCssDim(slide.cta_margin_right_desktop ?? slide.cta_margin_right_px, '0px'),
                            }
                          : undefined
                      }
                      className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-montserrat font-semibold text-sm sm:text-base hover:bg-white/90 transition shadow-sm"
                      data-testid="hero-cta"
                    >
                      {slide.cta_label} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  {/* Mobile */}
                  <div
                    className={`flex md:hidden w-full ${
                      (slide.cta_align_mobile || slide.cta_align) === 'center'
                        ? 'justify-center text-center'
                        : (slide.cta_align_mobile || slide.cta_align) === 'right'
                        ? 'justify-end text-right'
                        : 'justify-start text-left'
                    }`}
                  >
                    <Link
                      to={slide.cta_link}
                      style={{
                        marginTop: toCssDim(slide.cta_margin_top_mobile ?? slide.cta_margin_top_mobile_px, '16px'),
                        marginBottom: toCssDim(slide.cta_margin_bottom_mobile ?? slide.cta_margin_bottom_mobile_px, '0px'),
                        marginLeft: toCssDim(slide.cta_margin_left_mobile ?? slide.cta_margin_left_mobile_px, '0px'),
                        marginRight: toCssDim(slide.cta_margin_right_mobile ?? slide.cta_margin_right_mobile_px, '0px'),
                      }}
                      className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 rounded-lg font-montserrat font-semibold text-sm hover:bg-white/90 transition shadow-sm"
                      data-testid="hero-cta-mobile"
                    >
                      {slide.cta_label} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </>
              ) : (
                <div
                  className={`w-full flex ${
                    slide.cta_align === 'center'
                      ? 'justify-center text-center'
                      : slide.cta_align === 'right'
                      ? 'justify-end text-right'
                      : 'justify-start text-left'
                  } ${Boolean(slide.cta_custom_margins || slide.cta_margin_top === 'custom') ? '' : 'mt-5 sm:mt-8'}`}
                >
                  <Link
                    to={slide.cta_link}
                    style={
                      Boolean(slide.cta_custom_margins || slide.cta_margin_top === 'custom')
                        ? {
                            marginTop: toCssDim(slide.cta_margin_top_desktop ?? slide.cta_margin_top_px, '32px'),
                            marginBottom: toCssDim(slide.cta_margin_bottom_desktop ?? slide.cta_margin_bottom_px, '0px'),
                            marginLeft: toCssDim(slide.cta_margin_left_desktop ?? slide.cta_margin_left_px, '0px'),
                            marginRight: toCssDim(slide.cta_margin_right_desktop ?? slide.cta_margin_right_px, '0px'),
                          }
                        : undefined
                    }
                    className="inline-flex items-center gap-2 bg-white text-brand-main px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-montserrat font-semibold text-sm sm:text-base hover:bg-white/90 transition shadow-sm"
                    data-testid="hero-cta"
                  >
                    {slide.cta_label} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Setas (só se >1 slide) */}
      {total > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center transition" aria-label="Slide anterior" data-testid="hero-prev">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button onClick={next} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur flex items-center justify-center transition" aria-label="Próximo slide" data-testid="hero-next">
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </>
      )}

      {total > 1 && showDots && (
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
