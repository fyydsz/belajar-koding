import { useTreeContext, useTreePath } from '@fumadocs/base-ui/contexts/tree';
import { type FC, Fragment, type ReactNode, createContext, use, useMemo, Suspense } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import type * as Base from './base';
import { usePathname } from 'fumadocs-core/framework';
import { useSearchParams } from 'next/navigation';
import { isNodeActive } from '../../lib/urls';

export interface SidebarPageTreeComponents {
  Item: FC<{ item: PageTree.Item }>;
  Folder: FC<{ item: PageTree.Folder; children: ReactNode }>;
  Separator: FC<{ item: PageTree.Separator }>;
}

const RendererContext = createContext<
  | (Partial<SidebarPageTreeComponents> & {
      pathname: string;
      searchParams: URLSearchParams | null;
    })
  | null
>(null);

type InternalComponents = Pick<
  typeof Base,
  | 'SidebarSeparator'
  | 'SidebarFolder'
  | 'SidebarFolderLink'
  | 'SidebarFolderContent'
  | 'SidebarFolderTrigger'
  | 'SidebarItem'
>;

export function createPageTreeRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarSeparator,
  SidebarItem,
}: InternalComponents) {
  function renderList(nodes: PageTree.Node[]) {
    return nodes.map((node, i) => <PageTreeNode key={i} node={node} />);
  }

  function PageTreeNode({ node }: { node: PageTree.Node }) {
    const { Separator, Item, Folder, pathname, searchParams } = use(RendererContext)!;

    if (node.type === 'separator') {
      if (Separator) return <Separator item={node} />;
      return (
        <SidebarSeparator>
          {node.icon}
          {node.name}
        </SidebarSeparator>
      );
    }

    if (node.type === 'folder') {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const path = useTreePath();
      if (Folder) return <Folder item={node}>{renderList(node.children)}</Folder>;

      return (
        <SidebarFolder
          collapsible={node.collapsible}
          active={path.includes(node)}
          defaultOpen={node.defaultOpen}
        >
          {node.index ? (
            <SidebarFolderLink
              href={node.index.url}
              active={isNodeActive(node.index.url, pathname, searchParams, true)}
              external={node.index.external}
            >
              {node.icon}
              {node.name}
            </SidebarFolderLink>
          ) : (
            <SidebarFolderTrigger>
              {node.icon}
              {node.name}
            </SidebarFolderTrigger>
          )}
          <SidebarFolderContent>{renderList(node.children)}</SidebarFolderContent>
        </SidebarFolder>
      );
    }

    if (Item) return <Item item={node} />;

    return (
      <SidebarItem
        href={node.url}
        external={node.external}
        active={isNodeActive(node.url, pathname, searchParams, false)}
        icon={node.icon}
      >
        {node.name}
      </SidebarItem>
    );
  }

  function SidebarPageTreeContent(components: Partial<SidebarPageTreeComponents>) {
    const { Folder, Item, Separator } = components;
    const { root } = useTreeContext();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return (
      <RendererContext
        value={useMemo(
          () => ({ Folder, Item, Separator, pathname, searchParams }),
          [Folder, Item, Separator, pathname, searchParams],
        )}
      >
        <Fragment key={root.$id}>{renderList(root.children)}</Fragment>
      </RendererContext>
    );
  }

  function SidebarPageTreeFallback(components: Partial<SidebarPageTreeComponents>) {
    const { Folder, Item, Separator } = components;
    const { root } = useTreeContext();
    const pathname = usePathname();

    return (
      <RendererContext
        value={useMemo(
          () => ({ Folder, Item, Separator, pathname, searchParams: null }),
          [Folder, Item, Separator, pathname],
        )}
      >
        <Fragment key={root.$id}>{renderList(root.children)}</Fragment>
      </RendererContext>
    );
  }

  /**
   * Render sidebar items from page tree
   */
  return function SidebarPageTree(components: Partial<SidebarPageTreeComponents>) {
    return (
      <Suspense fallback={<SidebarPageTreeFallback {...components} />}>
        <SidebarPageTreeContent {...components} />
      </Suspense>
    );
  };
}
