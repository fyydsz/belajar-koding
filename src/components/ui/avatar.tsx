'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Avatar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative flex size-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AvatarImage({
  src,
  alt,
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [hasError, setHasError] = React.useState(!src);

  React.useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (hasError || !src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-fd-muted text-xs font-semibold text-fd-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
