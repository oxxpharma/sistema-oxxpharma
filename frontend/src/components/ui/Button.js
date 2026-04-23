import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export const Button = React.forwardRef(({
  className,
  variant = 'primary',
  size = 'default',
  loading = false,
  children,
  ...props
}, ref) => {
  const variants = {
    primary: 'bg-brand-main text-white hover:bg-brand-hover shadow-sm',
    secondary: 'bg-white text-brand-main border border-border hover:bg-brand-light',
    outline: 'bg-transparent text-txt-primary border border-border hover:bg-bg-secondary',
    ghost: 'bg-transparent text-txt-primary hover:bg-bg-secondary',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    dark: 'bg-txt-primary text-white hover:bg-black',
  };
  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    default: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3 text-base',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
});
Button.displayName = 'Button';
