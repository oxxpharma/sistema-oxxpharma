import React from 'react';
import { useSiteSettings } from '../../hooks/useSiteSettings';

// Dimensões padrão por slot (fallback se nao houver config no DB)
const DEFAULTS = {
  store_header:        { height: 40, max_width: 180 },
  store_header_mobile: { height: 32, max_width: 140 },
  store_footer:        { height: 36, max_width: 160 },
  admin_sidebar:       { height: 36, max_width: 160 },
  admin_topbar:        { height: 28, max_width: 140 },
  auth_pages:          { height: 48, max_width: 200 },
  invoice:             { height: 56, max_width: 220 },
  email_header:        { height: 48, max_width: 200 },
  email_footer:        { height: 32, max_width: 140 },
};

export function getLogoSize(settings, slot, customFallback) {
  const map = settings?.logo_sizes || {};
  const cfg = map[slot] || customFallback || DEFAULTS[slot] || { height: 40, max_width: 180 };
  return { height: Number(cfg.height) || 40, max_width: Number(cfg.max_width) || 180 };
}

/**
 * BrandLogo - logo da loja (ou nome fallback) em cada local.
 *
 * Props:
 *  - slot: 'store_header' | 'store_header_mobile' | 'store_footer' | 'admin_sidebar' | 'admin_topbar' | 'auth_pages' | 'invoice'
 *  - variant: 'light' (fundo claro, logo normal) | 'dark' (fundo escuro, logo clara se existir)
 *  - textClassName: classes aplicadas no fallback (texto)
 *  - showIcon: quando é fallback de texto, mostra também o quadradinho ao lado (default true)
 */
export default function BrandLogo({
  slot = 'store_header',
  variant = 'light',
  textClassName = 'font-heading font-black text-xl',
  showIcon = true,
}) {
  const s = useSiteSettings();
  const storeName = s?.store_name || 'OxxPharma';

  const url = variant === 'dark'
    ? (s?.logo_dark_url || s?.logo_url || '')
    : (s?.logo_url || '');

  const firstLetter = (storeName[0] || 'O').toUpperCase();

  // Caso especial: cabeçalho da loja suporta tamanhos desktop e mobile separados
  if (slot === 'store_header') {
    const desk = getLogoSize(s, 'store_header');
    const mob = getLogoSize(s, 'store_header_mobile', { height: Math.min(desk.height, 40), max_width: Math.min(desk.max_width, 160) });

    if (url) {
      return (
        <>
          <img
            src={url}
            alt={storeName}
            className="object-contain hidden md:block"
            style={{ height: `${desk.height}px`, maxWidth: `${desk.max_width}px` }}
            data-testid="brand-logo-store_header-desktop"
          />
          <img
            src={url}
            alt={storeName}
            className="object-contain block md:hidden"
            style={{ height: `${mob.height}px`, maxWidth: `${mob.max_width}px` }}
            data-testid="brand-logo-store_header-mobile"
          />
        </>
      );
    }

    return (
      <>
        {/* Desktop Fallback */}
        <div className="hidden md:flex items-center gap-2" data-testid="brand-logo-store_header-desktop">
          {showIcon && (
            <div
              className="rounded-lg bg-brand-main flex items-center justify-center flex-shrink-0"
              style={{ width: `${Math.round(desk.height * 0.85)}px`, height: `${Math.round(desk.height * 0.85)}px` }}
            >
              <span
                className="text-white font-heading font-black"
                style={{ fontSize: `${Math.round(desk.height * 0.45)}px`, lineHeight: 1 }}
              >
                {firstLetter}
              </span>
            </div>
          )}
          <span className={textClassName}>{storeName}</span>
        </div>

        {/* Mobile Fallback */}
        <div className="flex md:hidden items-center gap-2" data-testid="brand-logo-store_header-mobile">
          {showIcon && (
            <div
              className="rounded-lg bg-brand-main flex items-center justify-center flex-shrink-0"
              style={{ width: `${Math.round(mob.height * 0.85)}px`, height: `${Math.round(mob.height * 0.85)}px` }}
            >
              <span
                className="text-white font-heading font-black"
                style={{ fontSize: `${Math.round(mob.height * 0.45)}px`, lineHeight: 1 }}
              >
                {firstLetter}
              </span>
            </div>
          )}
          <span className={textClassName}>{storeName}</span>
        </div>
      </>
    );
  }

  // Demais slots padrão
  const { height, max_width } = getLogoSize(s, slot);

  if (url) {
    return (
      <img
        src={url}
        alt={storeName}
        className="object-contain"
        style={{ height: `${height}px`, maxWidth: `${max_width}px` }}
        data-testid={`brand-logo-${slot}`}
      />
    );
  }

  // Fallback: quadrado + nome
  return (
    <div className="flex items-center gap-2" data-testid={`brand-logo-${slot}`}>
      {showIcon && (
        <div
          className="rounded-lg bg-brand-main flex items-center justify-center flex-shrink-0"
          style={{ width: `${Math.round(height * 0.85)}px`, height: `${Math.round(height * 0.85)}px` }}
        >
          <span
            className="text-white font-heading font-black"
            style={{ fontSize: `${Math.round(height * 0.45)}px`, lineHeight: 1 }}
          >
            {firstLetter}
          </span>
        </div>
      )}
      <span className={textClassName}>{storeName}</span>
    </div>
  );
}
