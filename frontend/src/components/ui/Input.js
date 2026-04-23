import React from 'react';
import { cn } from '../../lib/utils';

const baseField = 'w-full h-11 px-4 bg-white border border-border rounded-lg text-sm text-txt-primary focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition placeholder:text-gray-400 disabled:bg-bg-secondary';

export const Input = React.forwardRef(({ className, label, error, hint, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && <label className="block text-sm font-medium text-txt-primary">{label}</label>}
    <input ref={ref} className={cn(baseField, error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500', className)} {...props} />
    {hint && !error && <p className="text-xs text-txt-secondary">{hint}</p>}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
Input.displayName = 'Input';

export const Select = React.forwardRef(({ className, label, error, children, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && <label className="block text-sm font-medium text-txt-primary">{label}</label>}
    <select ref={ref} className={cn(baseField, error && 'border-red-500', className)} {...props}>
      {children}
    </select>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef(({ className, label, error, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && <label className="block text-sm font-medium text-txt-primary">{label}</label>}
    <textarea ref={ref} className={cn('w-full px-4 py-3 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition resize-none', error && 'border-red-500', className)} {...props} />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
Textarea.displayName = 'Textarea';
