'use client';

import { useTreeContext, useTreePath } from '@fumadocs/base-ui/contexts/tree';
import { cn } from '../../../../lib/cn';
import { type BreadcrumbOptions, getBreadcrumbItemsFromPath } from 'fumadocs-core/breadcrumb';
import type { Folder } from 'fumadocs-core/page-tree';
import { ChevronRight } from 'lucide-react';
import Link from 'fumadocs-core/link';
import { type ComponentProps, useMemo, Fragment } from 'react';

export type BreadcrumbProps = BreadcrumbOptions & ComponentProps<'div'>;

export function Breadcrumb({
  includeRoot,
  includeSeparator,
  includePage = true,
  ...props
}: BreadcrumbProps) {
  const path = useTreePath();
  const { root } = useTreeContext();
  const items = useMemo(() => {
    const rawItems = getBreadcrumbItemsFromPath(root, path, {
      includePage,
      includeSeparator,
      includeRoot,
    });

    return rawItems.map((item) => {
      const folderNode = path.find(
        (p): p is Folder =>
          p.type === 'folder' && (p.name === item.name || (!!p.index && p.index.url === item.url))
      );
      if (folderNode?.index?.name) {
        return {
          ...item,
          name: folderNode.index.name,
        };
      }
      return item;
    });
  }, [includePage, includeRoot, includeSeparator, path, root]);

  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      {...props}
      className={cn('flex items-center gap-1.5 text-xs sm:text-sm text-fd-muted-foreground mb-3', props.className)}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const className = cn(
          'truncate transition-colors',
          isLast ? 'text-fd-foreground font-medium' : 'hover:text-fd-foreground'
        );

        return (
          <Fragment key={i}>
            {i !== 0 && <ChevronRight className="size-3.5 shrink-0 text-fd-muted-foreground/60" />}
            {item.url && !isLast ? (
              <Link href={item.url} className={className}>
                {item.name}
              </Link>
            ) : (
              <span className={className}>{item.name}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
