import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Hero carrossel - exibe um ou mais slides com autoplay.
 *
 * Props:
 *  - slides: [{title, subtitle, image_url, cta_label, cta_link, overlay_opacity}]
 *  - settings: site settings (autoplay_seconds, show_dots, tagline)
 */
export default function HeroCarousel({ slides = [], settings }) {
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

  const effectiveMaxH = slide.max_height_px
    ? Number(slide.max_height_px)
    : cfg.hero_max_height_px || cfg.max_height_px
    ? Number(cfg.hero_max_height_px || cfg.max_height_px)
    : null;
  const sectionStyle = effectiveMaxH ? { maxHeight: `${effectiveMaxH}px` } : undefined;
  const innerContainerStyle = effectiveMaxH
    ? {
        maxHeight: `${effectiveMaxH}px`,
        minHeight: `min(100%, ${effectiveMaxH}px)`,
      }
    : undefined;

  return (
    <section
      className="relative text-white overflow-hidden"
      style={sectionStyle}
      data-testid="hero-carousel"
      data-current-slide={idx}
    >
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

      <div
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 md:py-20 min-h-[280px] sm:min-h-[360px] md:min-h-[440px] flex items-center"
        style={innerContainerStyle}
      >
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
                              marginTop: `${Number(slide.cta_margin_top_px ?? 32)}px`,
                              marginBottom: `${Number(slide.cta_margin_bottom_px ?? 0)}px`,
                              marginLeft: `${Number(slide.cta_margin_left_px ?? 0)}px`,
                              marginRight: `${Number(slide.cta_margin_right_px ?? 0)}px`,
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
                        marginTop: `${Number(slide.cta_margin_top_mobile_px ?? 16)}px`,
                        marginBottom: `${Number(slide.cta_margin_bottom_mobile_px ?? 0)}px`,
                        marginLeft: `${Number(slide.cta_margin_left_mobile_px ?? 0)}px`,
                        marginRight: `${Number(slide.cta_margin_right_mobile_px ?? 0)}px`,
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
                            marginTop: `${Number(slide.cta_margin_top_px ?? 32)}px`,
                            marginBottom: `${Number(slide.cta_margin_bottom_px ?? 0)}px`,
                            marginLeft: `${Number(slide.cta_margin_left_px ?? 0)}px`,
                            marginRight: `${Number(slide.cta_margin_right_px ?? 0)}px`,
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

      {/* Indicadores */}
      {total > 1 && showDots && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" data-testid="hero-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? 'bg-white w-8' : 'bg-white/40 w-2 hover:bg-white/60'}`}
              aria-label={`Slide ${i + 1}`}
              data-testid={`hero-dot-${i}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
