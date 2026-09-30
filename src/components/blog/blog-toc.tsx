'use client';

import {
  useState,
  useRef,
  useEffect,
  type ComponentProps,
} from 'react';
import * as Base from '@/components/toc';
import * as TocDefault from '@/components/toc/default';
import { Text, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TOCItemType } from 'fumadocs-core/toc';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

export function BlogTOCProvider({
  toc,
  children,
}: {
  toc: TOCItemType[];
  children: React.ReactNode;
}) {
  return <Base.TOCProvider toc={toc}>{children}</Base.TOCProvider>;
}

export function BlogDesktopTOC() {
  const items = Base.useTOCItems();

  if (!items || items.length === 0) return null;

  return (
    <aside
      aria-label="Daftar Isi Artikel"
      className="hidden xl:flex flex-col w-64 shrink-0 sticky top-20 h-fit max-h-[calc(100vh-6rem)] pe-4 pb-4"
    >
      <h3
        id="toc-title"
        className="inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground mb-3 font-medium shrink-0"
      >
        <Text className="size-4" aria-hidden="true" />
        <span>Daftar Isi</span>
      </h3>
      <Base.TOCScrollArea className="ms-px flex-1 min-h-0">
        <TocDefault.TOCItems>
          {items.map((item) => (
            <TocDefault.TOCItem key={item.url} item={item} />
          ))}
        </TocDefault.TOCItems>
      </Base.TOCScrollArea>
    </aside>
  );
}

function clamp(input: number, min: number, max: number): number {
  if (input < min) return min;
  if (input > max) return max;
  return input;
}

interface ProgressCircleProps extends Omit<ComponentProps<'svg'>, 'strokeWidth'> {
  value: number;
  strokeWidth?: number;
  size?: number;
  min?: number;
  max?: number;
}

function ProgressCircle({
  value,
  strokeWidth = 1.5,
  size = 18,
  min = 0,
  max = 100,
  style,
  className,
  ...restSvgProps
}: ProgressCircleProps) {
  const normalizedValue = clamp(value, min, max);
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const progress = (normalizedValue / max) * circumference;
  const circleProps = {
    cx: size / 2,
    cy: size / 2,
    r: radius,
    fill: 'none',
    strokeWidth,
  };

  return (
    <svg
      role="progressbar"
      viewBox={`0 0 ${size} ${size}`}
      aria-valuenow={normalizedValue}
      aria-valuemin={min}
      aria-valuemax={max}
      style={{ width: size, height: size, ...style }}
      className={className}
      {...restSvgProps}
    >
      <circle {...circleProps} className="stroke-current/25" />
      <circle
        {...circleProps}
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all"
      />
    </svg>
  );
}

export function BlogMobileTOC() {
  const items = Base.useTOCItems();
  const infoItems = Base.useItems();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIdx = infoItems.findIndex((item) => item.active);
  const showItem = selectedIdx !== -1 && !open;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        open &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [open]);

  if (!items || items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'sticky top-14 z-20 xl:hidden w-full border-b backdrop-blur-sm transition-colors',
        open ? 'bg-fd-background shadow-lg' : 'bg-fd-background/80 border-fd-border/70'
      )}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="flex w-full h-10 items-center text-sm text-fd-muted-foreground gap-2.5 px-4 sm:px-6 text-start focus-visible:outline-none max-w-6xl mx-auto"
          aria-expanded={open}
        >
          <ProgressCircle
            value={(infoItems.findLastIndex((item) => item.active) + 1) / Math.max(1, infoItems.length)}
            max={1}
            className={cn('shrink-0', open && 'text-fd-primary')}
          />
          <span className="grid flex-1 *:my-auto *:row-start-1 *:col-start-1 overflow-hidden">
            <span
              className={cn(
                'truncate transition-[opacity,translate,color]',
                open && 'text-fd-foreground',
                showItem && 'opacity-0 -translate-y-full pointer-events-none'
              )}
            >
              Daftar Isi
            </span>
            <span
              className={cn(
                'truncate transition-[opacity,translate]',
                !showItem && 'opacity-0 translate-y-full pointer-events-none'
              )}
            >
              {infoItems[selectedIdx]?.original.title}
            </span>
          </span>
          <ChevronDown
            className={cn('size-4 shrink-0 transition-transform duration-200 mx-0.5', open && 'rotate-180')}
            aria-hidden="true"
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-fd-border/60 bg-fd-background/95">
          <div className="flex flex-col px-4 sm:px-6 py-3 max-h-[50vh] overflow-y-auto max-w-6xl mx-auto">
            <Base.TOCScrollArea className="ms-px">
              <TocDefault.TOCItems>
                {items.map((item) => (
                  <TocDefault.TOCItem
                    key={item.url}
                    item={item}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </TocDefault.TOCItems>
            </Base.TOCScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
