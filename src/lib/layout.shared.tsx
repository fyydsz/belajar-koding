import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { appName, gitConfig } from './shared';
import { UserMenu } from '@/components/auth/user-menu';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src="/logo.jpg"
            alt={`Logo ${appName}`}
            width={28}
            height={28}
            className="size-7 rounded-full object-cover shrink-0 border border-fd-border shadow-2xs"
            priority
          />
          <span className="font-semibold">{appName}</span>
        </>
      ),
    },
    links: [
      {
        text: 'Dokumentasi',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'Blog',
        url: '/blog',
        active: 'nested-url',
      },
      {
        type: 'custom',
        secondary: true,
        children: <UserMenu />,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
