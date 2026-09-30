import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import type { Root, Heading } from 'mdast';
import { defineConfig } from 'fumadocs-mdx/config';

const STEP_TAG = '[step]';

function remarkTagSteps({ steps = 'fd-steps', step = 'fd-step' } = {}) {
    function convertToSteps(nodes: any[]) {
        const depth = nodes[0].depth;
        const children: any[] = [];
        for (const node of nodes) {
            if (node.type === 'heading' && node.depth === depth) {
                children.push({
                    type: 'mdxJsxFlowElement',
                    name: 'div',
                    attributes: [{ type: 'mdxJsxAttribute', name: 'className', value: step }],
                    children: [node],
                });
            } else {
                children[children.length - 1].children.push(node);
            }
        }
        return {
            type: 'mdxJsxFlowElement',
            name: 'div',
            attributes: [{ type: 'mdxJsxAttribute', name: 'className', value: steps }],
            children,
        };
    }

    function handleHeadingStep(node: Heading) {
        const tail = node.children[node.children.length - 1];
        if (tail && tail.type === 'text') {
            const idx = tail.value.indexOf(STEP_TAG);
            if (idx !== -1) {
                tail.value = (tail.value.slice(0, idx).trimEnd() + tail.value.slice(idx + STEP_TAG.length)).trimEnd();
                return true;
            }
        }
        return false;
    }

    return (tree: Root) => {
        visit(tree, (parent: any) => {
            if (!('children' in parent) || parent.type === 'heading') return 'skip';
            let startIdx = -1;
            let i = 0;
            let currentStep = 1;

            const onEnd = () => {
                if (startIdx === -1) return;
                const item = {};
                const nodes = parent.children.splice(startIdx, i - startIdx, item);
                Object.assign(item, convertToSteps(nodes));
                i = startIdx + 1;
                startIdx = -1;
                currentStep = 1;
            };

            for (; i < parent.children.length; i++) {
                const node = parent.children[i];
                if (node.type !== 'heading' || (node.data as any)?.hProperties?.['data-fd-step'] !== undefined) continue;

                if (startIdx !== -1) {
                    const startDepth = parent.children[startIdx].depth;
                    if (node.depth !== startDepth) {
                        if (node.depth < startDepth) onEnd();
                        continue;
                    }
                }

                if (!handleHeadingStep(node)) {
                    onEnd();
                    continue;
                }

                node.data ??= {};
                (node.data as any).hProperties ??= {};
                (node.data as any).hProperties['data-fd-step'] = currentStep++;
                if (startIdx === -1) startIdx = i;
            }

            onEnd();
        });
    };
}

export default defineConfig({
    mdxOptions: {
        remarkPlugins: [remarkMath, remarkTagSteps],
        // Place it at first, it should be executed before the syntax highlighter
        rehypePlugins: (v) => [rehypeKatex, ...v],
    },
});
