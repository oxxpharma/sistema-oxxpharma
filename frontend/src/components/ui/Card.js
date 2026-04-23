import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('rounded-xl bg-white border border-border shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
}
export function CardHeader({ className, children }) {
  return <div className={cn('px-6 pt-6', className)}>{children}</div>;
}
export function CardTitle({ className, children }) {
  return <h3 className={cn('font-heading font-bold text-lg text-txt-primary', className)}>{children}</h3>;
}
export function CardDescription({ className, children }) {
  return <p className={cn('text-sm text-txt-secondary mt-1', className)}>{children}</p>;
}
export function CardContent({ className, children }) {
  return <div className={cn('p-6', className)}>{children}</div>;
}
export function CardFooter({ className, children }) {
  return <div className={cn('px-6 pb-6', className)}>{children}</div>;
}
