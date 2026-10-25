'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ExternalLink } from 'lucide-react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Callout } from 'fumadocs-ui/components/callout';
import { cn } from '@/lib/cn';

interface DynamicMDXRendererProps {
  content: string;
  className?: string;
}

interface FumadocsCodeBlockWrapperProps {
  code: string;
  language?: string;
  title?: string;
}

function FumadocsCodeBlockWrapper({ code, language, title }: FumadocsCodeBlockWrapperProps) {
  return (
    <DynamicCodeBlock
      lang={language || 'text'}
      code={code}
      codeblock={{
        title,
        allowCopy: true,
      }}
    />
  );
}

function parseCalloutTags(text: string): string {
  return text.replace(/<Callout([^>]*)>([\s\S]*?)<\/Callout>/gi, (_, attrs, body) => {
    const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toUpperCase() : 'NOTE';
    const title = titleMatch ? ` ${titleMatch[1]}` : '';
    const bodyLines = body
      .trim()
      .split('\n')
      .map((line: string) => `> ${line}`)
      .join('\n');
    return `> [!${type}]${title}\n${bodyLines}`;
  });
}

function parseAlertFromChildren(children: React.ReactNode) {
  const childrenArray = React.Children.toArray(children);
  const pChild = childrenArray.find((c) => React.isValidElement(c)) as React.ReactElement<any> | undefined;
  if (!pChild || !pChild.props || !pChild.props.children) {
    return null;
  }

  const pChildren = React.Children.toArray(pChild.props.children);
  if (pChildren.length === 0 || typeof pChildren[0] !== 'string') {
    return null;
  }

  const firstString = pChildren[0];
  const alertMatch = firstString.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|IDEA)\]([^\r\n]*)[\r\n\s]*/i);
  if (!alertMatch) {
    return null;
  }

  const alertType = alertMatch[1].toUpperCase();
  const inlineTitle = alertMatch[2]?.trim();
  const restOfFirstString = firstString.slice(alertMatch[0].length);

  const newPChildren = [
    restOfFirstString,
    ...pChildren.slice(1),
  ].filter((c) => c !== '');

  const newP = React.cloneElement(pChild, {}, ...newPChildren);
  const cleanChildren = childrenArray.map((c) => (c === pChild ? newP : c));

  return {
    alertType,
    customTitle: inlineTitle || undefined,
    cleanChildren,
  };
}

function CustomBlockquote({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: any;
}) {
  const parsed = parseAlertFromChildren(children);

  if (parsed) {
    const { alertType, customTitle, cleanChildren } = parsed;

    const typeConfig: Record<
      string,
      { type: 'info' | 'warn' | 'error' | 'idea'; defaultTitle: string }
    > = {
      NOTE: { type: 'info', defaultTitle: 'Catatan' },
      INFO: { type: 'info', defaultTitle: 'Informasi' },
      TIP: { type: 'info', defaultTitle: 'Tips & Saran' },
      IDEA: { type: 'idea', defaultTitle: 'Ide' },
      WARNING: { type: 'warn', defaultTitle: 'Peringatan' },
      IMPORTANT: { type: 'warn', defaultTitle: 'Penting' },
      CAUTION: { type: 'error', defaultTitle: 'Perhatian' },
      ERROR: { type: 'error', defaultTitle: 'Error' },
    };

    const config = typeConfig[alertType] || { type: 'info', defaultTitle: 'Info' };
    const title = customTitle || config.defaultTitle;

    return (
      <Callout
        type={config.type}
        title={title}
        className="not-prose my-4"
        {...props}
      >
        <div className="text-fd-muted-foreground text-sm [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {cleanChildren}
        </div>
      </Callout>
    );
  }

  return (
    <blockquote
      className="my-5 border-l-2 border-fd-border pl-4 py-1 text-fd-muted-foreground italic text-[15px] [&>p]:my-1"
      {...props}
    >
      {children}
    </blockquote>
  );
}

export function DynamicMDXRenderer({ content, className }: DynamicMDXRendererProps) {
  const cleanContent = parseCalloutTags(content || '');

  return (
    <div
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none text-fd-foreground',
        'prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-fd-foreground',
        'prose-h1:text-2xl sm:prose-h1:text-3xl prose-h1:mt-6 prose-h1:mb-3',
        'prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3',
        'prose-h3:text-lg sm:prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2',
        'prose-p:leading-relaxed prose-p:my-4 prose-p:text-fd-foreground/90 text-[15px] sm:text-base',
        'prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:leading-relaxed text-[15px] sm:text-base',
        'prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-fd-muted prose-code:text-fd-primary prose-code:font-mono prose-code:text-xs prose-code:before:content-none prose-code:after:content-none',
        'prose-table:border prose-table:border-fd-border prose-th:bg-fd-muted/40 prose-th:p-2.5 prose-td:p-2.5 prose-td:border-t prose-td:border-fd-border',
        'prose-hr:my-8 prose-hr:border-fd-border/50',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          blockquote: CustomBlockquote,
          pre: (preProps: any) => {
            const childrenArray = React.Children.toArray(preProps.children);
            const codeChild = childrenArray[0] as React.ReactElement<any>;
            if (React.isValidElement(codeChild)) {
              const codeProps = codeChild.props as any;
              const rawCode = String(codeProps?.children || '').replace(/\n$/, '');
              const className = codeProps?.className || '';
              const matchLang = className.match(/language-(\w+)/);
              const language = matchLang ? matchLang[1] : '';
              const meta = codeProps?.node?.data?.meta || codeProps?.node?.meta || '';
              const titleMatch = meta.match(/title="([^"]+)"/) || meta.match(/title=([^\s]+)/);
              const title = titleMatch ? titleMatch[1] : undefined;

              return (
                <FumadocsCodeBlockWrapper
                  code={rawCode}
                  language={language}
                  title={title}
                />
              );
            }
            return <pre {...preProps} />;
          },
          code: ({ className: _className, children: codeChildren, ...props }: any) => {
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-fd-muted text-fd-primary font-mono text-xs"
                {...props}
              >
                {codeChildren}
              </code>
            );
          },
          a: ({ href, children, ...props }) => {
            const isExternal = href?.startsWith('http') || href?.startsWith('//');
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-1 text-fd-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity"
                {...props}
              >
                {children}
                {isExternal && <ExternalLink className="size-3 inline-block" />}
              </a>
            );
          },
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
}
