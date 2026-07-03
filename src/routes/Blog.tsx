import { For } from 'solid-js';
import { A } from '@solidjs/router';
import { articlesByDate } from '../lib/blog/articles';
import { formatBlogDate } from '../lib/blog/date';

export default function Blog() {
  const posts = articlesByDate();

  return (
    <div class="blog shell">
      <header class="blog__head">
        <p class="blog__eyebrow">☼ FIELD NOTES FROM THE ARCHIVE ☼</p>
        <h1 class="blog__title">
          The whisk <em>notebook.</em>
        </h1>
        <p class="blog__lede">
          Practical guides to searching Wikipedia, falling down better rabbit holes, and finding the
          articles the encyclopedia keeps buried.
        </p>
      </header>

      <div class="blog__grid">
        <For each={posts}>
          {(post) => (
            <A href={`/blog/${post.slug}`} class="blog-card" data-cluster={post.cluster}>
              <span class="blog-card__date mono">{formatBlogDate(post.date)}</span>
              <h2 class="blog-card__title">{post.title}</h2>
              <p class="blog-card__excerpt">{post.excerpt}</p>
              <div class="blog-card__tags">
                <For each={post.tags}>{(t) => <span class="tag">{t}</span>}</For>
              </div>
            </A>
          )}
        </For>
      </div>
    </div>
  );
}
