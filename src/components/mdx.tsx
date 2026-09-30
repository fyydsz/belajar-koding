import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Heading as OriginalHeading } from 'fumadocs-ui/components/heading';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';

function createHeading(as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return function CustomHeading({
    children,
    ...props
  }: ComponentProps<typeof OriginalHeading> & {
    'data-fd-step'?: any;
    'data-step'?: any;
  }) {
    const isStep =
      props['data-fd-step'] !== undefined || props['data-step'] !== undefined;
    const isH1 = as === 'h1';

    return (
      <OriginalHeading as={as} {...props}>
        {!isH1 && !isStep && (
          <span
            className="text-fd-primary/70 select-none mr-2 font-mono font-normal inline-block"
            aria-hidden="true"
          >
            #
          </span>
        )}
        {children}
      </OriginalHeading>
    );
  };
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    h1: createHeading('h1'),
    h2: createHeading('h2'),
    h3: createHeading('h3'),
    h4: createHeading('h4'),
    h5: createHeading('h5'),
    h6: createHeading('h6'),
    Step,
    Steps,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
