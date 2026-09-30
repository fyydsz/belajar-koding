import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const primary = 'bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/80';

const variants = {
  default: primary,
  primary,
  outline: 'border border-fd-border hover:bg-fd-accent hover:text-fd-accent-foreground',
  ghost: 'hover:bg-fd-accent hover:text-fd-accent-foreground',
  secondary:
    'border border-fd-border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
} as const;

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg p-2 text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring cursor-pointer',
  {
    variants: {
      variant: variants,
      color: variants,
      size: {
        sm: 'gap-1 px-2 py-1.5 text-xs',
        icon: 'p-1.5 [&_svg]:size-5',
        'icon-sm': 'p-1.5 [&_svg]:size-4.5',
        'icon-xs': 'p-1 [&_svg]:size-4',
      },
    },
  },
);

export type ButtonProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  color,
  size,
  ...props
}: Omit<React.ComponentProps<'button'>, 'color'> & ButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants({ variant, color, size }),
        !size && 'min-h-[44px] px-4 py-2.5',
        className
      )}
      {...props}
    />
  );
}
