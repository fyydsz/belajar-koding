import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const primary = 'bg-fd-primary text-fd-primary-foreground shadow-2xs hover:bg-fd-primary/90';

const variants = {
  default: primary,
  primary,
  outline:
    'border border-fd-border bg-fd-card/80 text-fd-foreground shadow-2xs hover:bg-fd-accent hover:text-fd-accent-foreground',
  ghost: 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground',
  secondary:
    'border border-fd-border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
} as const;

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring cursor-pointer whitespace-nowrap',
  {
    variants: {
      variant: variants,
      color: variants,
      size: {
        sm: 'h-9 gap-1.5 px-3.5 py-1.5 text-xs',
        icon: 'size-9 p-1.5 [&_svg]:size-4.5',
        'icon-sm': 'size-8 p-1.5 [&_svg]:size-4',
        'icon-xs': 'size-7 p-1 [&_svg]:size-3.5',
      },
    },
  },
);

export type ButtonProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant = 'default',
  color,
  size,
  ...props
}: Omit<React.ComponentProps<'button'>, 'color'> & ButtonProps & { color?: any }) {
  return (
    <button
      className={cn(
        buttonVariants({ variant, color, size }),
        !size && 'h-10 px-4 py-2',
        className
      )}
      {...props}
    />
  );
}
