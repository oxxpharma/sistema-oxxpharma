import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Hero carrossel - exibe um ou mais slides com autoplay.
 *
 * Props:
 *  - slides: [{title, subtitle, image_url, cta_label, cta_link, overlay_opacity}]
 *  - settings: site settings (autoplay_seconds, show_dots, tagline)
 *  - secondaryLink: link adicional fixo (ex: "Indique e ganhe")
 */
export default function HeroCarousel({ slides = [], settings, secondaryLink }) {
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

  return (
    <section
      className="relative text-white overflow-hidden"
      data-testid="hero-carousel"
      data-current-slide={idx}
    >
      {/* Imagem de fundo com transicao suave */}
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
                    backgroundRepeat: 'no-repeat',
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 min-h-[360px] md:min-h-[440px] flex items-center">
        <div className="fade-in max-w-2xl">
          {cfg.tagline && (
            <div className="inline-block bg-white/15 backdrop-blur text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              {cfg.tagline}
            </div>
          )}
          <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl leading-tight" data-testid="hero-title">
            {slide.title || 'Saúde e bem-estar na sua porta.'}
          </h1>
          {slide.subtitle && (
            <p className="mt-4 text-white/90 text-base md:text-lg max-w-md" data-testid="hero-subtitle">
              {slide.subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {slide.cta_label && slide.cta_link && (
              <Link
                to={slide.cta_link}
                className="inline-flex items-center gap-2 bg-white text-brand-main px-6 py-3 rounded-lg font-bold hover:bg-white/90 transition"
                data-testid="hero-cta"
              >
                {slide.cta_label} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            {secondaryLink}
          </div>
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
