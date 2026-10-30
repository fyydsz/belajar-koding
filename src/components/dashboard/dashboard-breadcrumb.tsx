'use client';

import React from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/cn';

export interface DashboardBreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface DashboardBreadcrumbProps {
  items: DashboardBreadcrumbItem[];
  className?: string;
}

/**
 * Standard breadcrumb component for dashboard pages.
 * Ensures consistent positioning, typography, separators, and truncation across all views.
 */
export function DashboardBreadcrumb({ items, className }: DashboardBreadcrumbProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={cn('pb-1', className)}>
      <Breadcrumb>
        <BreadcrumbList className="text-xs text-fd-muted-foreground gap-1.5 flex-wrap">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;

            return (
              <React.Fragment key={`${item.label}-${idx}`}>
                <BreadcrumbItem className="inline-flex items-center gap-1.5">
                  {!isLast && item.href ? (
                    <BreadcrumbLink
                      render={<Link href={item.href} />}
                      className="inline-flex items-center gap-1.5 hover:text-fd-foreground transition-colors text-xs"
                    >
                      {item.icon}
                      <span className="truncate max-w-[180px] sm:max-w-xs">{item.label}</span>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="inline-flex items-center gap-1.5 text-xs font-medium text-fd-foreground">
                      {item.icon}
                      <span className="truncate max-w-[200px] sm:max-w-sm">{item.label}</span>
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>

                {!isLast && <BreadcrumbSeparator className="text-fd-muted-foreground/50" />}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
