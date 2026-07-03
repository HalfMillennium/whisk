import { For, type JSX } from 'solid-js';
import { A } from '@solidjs/router';

/**
 * Renders a blog article's `content[]` blocks using a tiny markdown subset —
 * no `innerHTML`, everything is real Solid JSX.
 *
 * Block level:
 *   `# text`   -> h2      `## text` -> h3      `### text` -> h4
 *   `- item`   -> <ul><li> (consecutive `- ` lines merge into one list)
 *   anything else -> <p>
 *
 * Inline (inside paragraphs, list items, and headings):
 *   **bold**          -> <strong>
 *   *italic*          -> <em>
 *   [label](href)     -> internal <A> for `/…`, external <a> otherwise
 */

type Inline = string;

// Split a line into inline nodes. Order matters: links first (they contain
// brackets/parens), then bold, then italic.
function renderInline(text: Inline): JSX.Element[] {
  const nodes: JSX.Element[] = [];
  // Combined matcher for [label](href), **bold**, *italic*.
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined && m[2] !== undefined) {
      const label = m[1];
      const href = m[2];
      if (href.startsWith('/')) {
        nodes.push(<A href={href}>{label}</A>);
      } else {
        nodes.push(
          <a href={href} target="_blank" rel="noreferrer">
            {label}
          </a>,
        );
      }
    } else if (m[3] !== undefined) {
      nodes.push(<strong>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(<em>{m[4]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: 'h'; level: 2 | 3 | 4; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

// Group the flat content array into structured blocks, merging runs of `- `
// lines into a single list.
function toBlocks(content: string[]): Block[] {
  const blocks: Block[] = [];
  for (const raw of content) {
    const line = raw.trimEnd();
    if (line.startsWith('### ')) {
      blocks.push({ kind: 'h', level: 4, text: line.slice(4) });
    } else if (line.startsWith('## ')) {
      blocks.push({ kind: 'h', level: 3, text: line.slice(3) });
    } else if (line.startsWith('# ')) {
      blocks.push({ kind: 'h', level: 2, text: line.slice(2) });
    } else if (line.startsWith('- ')) {
      const item = line.slice(2);
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === 'ul') prev.items.push(item);
      else blocks.push({ kind: 'ul', items: [item] });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return blocks;
}

export function BlogContent(props: { content: string[] }) {
  const blocks = () => toBlocks(props.content);
  return (
    <div class="blog-prose">
      <For each={blocks()}>
        {(block) => {
          if (block.kind === 'h') {
            if (block.level === 2) return <h2 class="blog-prose__h2">{renderInline(block.text)}</h2>;
            if (block.level === 3) return <h3 class="blog-prose__h3">{renderInline(block.text)}</h3>;
            return <h4 class="blog-prose__h4">{renderInline(block.text)}</h4>;
          }
          if (block.kind === 'ul') {
            return (
              <ul class="blog-prose__list">
                <For each={block.items}>{(item) => <li>{renderInline(item)}</li>}</For>
              </ul>
            );
          }
          return <p>{renderInline(block.text)}</p>;
        }}
      </For>
    </div>
  );
}
