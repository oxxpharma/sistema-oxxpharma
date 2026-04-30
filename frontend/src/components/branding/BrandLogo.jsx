import React from 'react';
import { useSiteSettings } from '../../hooks/useSiteSettings';

// Dimensões padrão por slot (fallback se nao houver config no DB)
const DEFAULTS = {
  store_header:  { height: 40, max_width: 180 },
  store_footer:  { height: 36, max_width: 160 },
  admin_sidebar: { height: 36, max_width: 160 },
  admin_topbar:  { height: 28, max_width: 140 },
  auth_pages:    { height: 48, max_width: 200 },
  invoice:       { height: 56, max_width: 220 },
};

export function getLogoSize(settings, slot) {
  const map = settings?.logo_sizes || {};
  const cfg = map[slot] || DEFAULTS[slot] || { height: 40, max_width: 180 };
  return { height: Number(cfg.height) || 40, max_width: Number(cfg.max_width) || 180 };
}

/**
 * BrandLogo - logo da loja (ou nome fallback) em cada local.
 *
 * Props:
 *  - slot: 'store_header' | 'store_footer' | 'admin_sidebar' | 'admin_topbar' | 'auth_pages' | 'invoice'
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
  const { height, max_width } = getLogoSize(s, slot);
  const storeName = s?.store_name || 'OxxPharma';

  const url = variant === 'dark'
    ? (s?.logo_dark_url || s?.logo_url || '')
    : (s?.logo_url || '');

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
  const firstLetter = (storeName[0] || 'O').toUpperCase();
  return (
    <div className="flex items-center gap-2" data-testid={`brand-logo-${slot}`}>
      {showIcon && (
        <div
          className="rounded-lg bg-brand-main flex items-center justify-center flex-shrink-0"
          style={{ width: `${Math.round(height * 0.85)}px`, height: `${Math.round(height * 0.85)}px` }}
        >
          <span
            className={variant === 'dark' ? 'text-white font-heading font-black' : 'text-white font-heading font-black'}
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
