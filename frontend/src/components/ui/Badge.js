import React from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, variant = 'default', children }) {
  const variants = {
    default: 'bg-bg-secondary text-txt-secondary',
    brand: 'bg-brand-light text-brand-main',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', variants[variant], className)}>
      {children}
    </span>
  );
}
