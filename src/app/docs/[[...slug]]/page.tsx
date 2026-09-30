import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from '@/layouts/notebook/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from '@/lib/shared';
import { findSiblings } from 'fumadocs-core/page-tree';
import Link from 'next/link';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { getCourseTracks } from '@/lib/courses';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            DocsCategory: (props: any) => {
              return <DocsCategory {...props} url={props.url ?? page.url} />;
            },
            CourseCards: () => <CourseCards />,
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImageUrl(page).url,
    },
  };
}

function DocsCategory({ url }: { url: string }) {
  return (
    <Cards>
      {findSiblings(source.getPageTree(), url).map((item) => {
        if (item.type === 'separator') return null;
        if (item.type === 'folder') {
          if (!item.index) return null;
          item = item.index;
        }

        return (
          <Card key={item.url} title={item.name} href={item.url}>
            {item.description}
          </Card>
        );
      })}
    </Cards>
  );
}

function CourseCards() {
  const tracks = getCourseTracks();
  return (
    <Cards>
      {tracks.map((track) => (
        <Link
          key={track.href}
          href={track.href}
          className="flex items-center gap-3.5 rounded-2xl border border-fd-border bg-fd-card/90 p-4 text-fd-card-foreground hover:bg-fd-accent/60 hover:border-fd-primary/30 transition-all not-prose no-underline shadow-2xs group"
        >
          {track.icon ? (
            <div className="size-9 rounded-xl bg-fd-primary/10 text-fd-primary border border-fd-primary/20 flex items-center justify-center shrink-0 [&_svg]:size-4.5 transition-colors group-hover:bg-fd-primary/20">
              {track.icon}
            </div>
          ) : null}
          <h3 className="text-sm font-semibold text-fd-foreground m-0 leading-snug group-hover:text-fd-primary transition-colors">
            {track.title}
          </h3>
        </Link>
      ))}
    </Cards>
  );
}
