import React from 'react';
import { DocsLayout } from '@/layouts/notebook';
import { baseOptions } from '@/lib/layout.shared';
import { dashboardPageTree } from '@/lib/dashboard-tree';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={dashboardPageTree}
      {...baseOptions()}
      containerProps={{
        style: {
          '--fd-toc-width': '0px',
        } as React.CSSProperties,
      }}
    >
      <main
        style={{ gridColumn: 'main-start / toc-end' }}
        className="flex flex-col items-center w-full min-w-0 py-6 md:py-8"
        data-layout-main=""
      >
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </DocsLayout>
  );
}
