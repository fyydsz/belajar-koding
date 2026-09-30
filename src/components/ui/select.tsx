'use client';

import * as React from 'react';
import { Select as Primitive } from '@base-ui/react/select';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';

export function Select({
  value,
  onValueChange,
  defaultValue,
  children,
  disabled,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Primitive.Root
      value={value}
      onValueChange={(val) => {
        if (typeof val === 'string' && onValueChange) {
          onValueChange(val);
        }
      }}
      defaultValue={defaultValue}
      disabled={disabled}
    >
      {children}
    </Primitive.Root>
  );
}

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-xl border border-fd-border bg-fd-card px-3 py-2 text-xs font-medium text-fd-foreground shadow-2xs transition hover:bg-fd-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <Primitive.Icon className="opacity-50">
        <ChevronDown className="size-4" />
      </Primitive.Icon>
    </Primitive.Trigger>
  );
}

export function SelectValue({
  placeholder,
  children,
}: {
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <Primitive.Value placeholder={placeholder}>
      {children}
    </Primitive.Value>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Popup>) {
  return (
    <Primitive.Portal>
      <Primitive.Positioner sideOffset={4} className="z-50 min-w-(--anchor-width)">
        <Primitive.Popup
          className={cn(
            'z-50 max-h-60 min-w-[8rem] overflow-hidden rounded-xl border border-fd-border bg-fd-card p-1 text-fd-foreground shadow-lg transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0',
            className
          )}
          {...props}
        >
          <Primitive.List className="p-1">
            {children}
          </Primitive.List>
        </Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  );
}

export function SelectItem({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Item> & { value: string }) {
  return (
    <Primitive.Item
      value={value}
      className={cn(
        'relative flex min-h-[36px] w-full cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-fd-foreground outline-none transition hover:bg-fd-muted focus-visible:bg-fd-muted data-highlighted:bg-fd-muted',
        className
      )}
      {...props}
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className="inline-flex items-center justify-center">
        <Check className="size-3.5 text-fd-primary" />
      </Primitive.ItemIndicator>
    </Primitive.Item>
  );
}
