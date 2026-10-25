import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const primary =
  'border border-transparent bg-fd-primary text-fd-primary-foreground shadow-2xs hover:bg-fd-primary/90';

const variants = {
  default: primary,
  primary,
  outline:
    'border border-fd-border bg-fd-card/80 text-fd-foreground shadow-2xs hover:bg-fd-accent hover:text-fd-accent-foreground',
  ghost:
    'border border-transparent text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground',
  secondary:
    'border border-fd-border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
  destructive:
    'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20',
} as const;

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring cursor-pointer whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: variants,
      color: variants,
      size: {
        default: 'h-9 gap-1.5 px-3.5 py-1.5 text-xs [&_svg:not([class*="size-"])]:size-3.5',
        sm: 'h-9 gap-1.5 px-3.5 py-1.5 text-xs [&_svg:not([class*="size-"])]:size-3.5',
        xs: 'h-8 gap-1 px-2.5 py-1 text-xs [&_svg:not([class*="size-"])]:size-3.5',
        lg: 'h-10 gap-2 px-4 py-2 text-sm [&_svg:not([class*="size-"])]:size-4',
        icon: 'size-9 p-0 [&_svg:not([class*="size-"])]:size-4',
        'icon-sm': 'size-9 p-0 [&_svg:not([class*="size-"])]:size-4',
        'icon-xs': 'size-8 p-0 [&_svg:not([class*="size-"])]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant = 'default',
  color,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'button'>, 'color'> & ButtonProps & { color?: any }) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, color, size }), className)}
      {...props}
    />
  );
}
