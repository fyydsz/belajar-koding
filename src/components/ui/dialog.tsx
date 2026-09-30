'use client';

import * as React from 'react';
import { Dialog as Primitive } from '@base-ui/react/dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogPortal = Primitive.Portal;
export const DialogClose = Primitive.Close;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Backdrop>) {
  return (
    <Primitive.Backdrop
      className={cn(
        'fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0',
        className
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Primitive.Popup> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <Primitive.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-fd-border bg-fd-card p-6 shadow-2xl transition-all duration-200 focus-visible:outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <Primitive.Close
            className="absolute right-4 top-4 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-fd-muted-foreground transition hover:bg-fd-muted hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            aria-label="Tutup dialog"
          >
            <X className="size-4" />
          </Primitive.Close>
        )}
      </Primitive.Popup>
    </DialogPortal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 text-start', className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Title>) {
  return (
    <Primitive.Title
      className={cn('text-base font-semibold leading-none tracking-tight text-fd-foreground', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description
      className={cn('text-xs text-fd-muted-foreground', className)}
      {...props}
    />
  );
}
