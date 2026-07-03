import { For, Show } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { getArticle, relatedArticles, articlesByDate } from '../lib/blog/articles';
import { formatBlogDate } from '../lib/blog/date';
import { BlogContent } from '../components/BlogContent';
import { EmptyState } from '../components/bits';
import { IconArrow, IconSearch, IconSpiral } from '../components/icons';

export default function BlogArticle() {
  const params = useParams();
  const slug = () => params.slug ?? '';
  const article = () => getArticle(slug());

  // Prev / next in newest-first reading order.
  const ordered = articlesByDate();
  const index = () => ordered.findIndex((a) => a.slug === slug());
  const newer = () => (index() > 0 ? ordered[index() - 1] : undefined);
  const older = () => (index() >= 0 && index() < ordered.length - 1 ? ordered[index() + 1] : undefined);

  return (
    <Show
      when={article()}
      fallback={
        <div class="shell blog-article">
          <A href="/blog" class="back-link">
            ← All articles
          </A>
          <EmptyState glyph="✦" title="We couldn't find that article">
            <p>
              It may have moved or never existed. Browse the <A href="/blog">whisk notebook</A> for
              everything we've written.
            </p>
          </EmptyState>
        </div>
      }
    >
      {(a) => (
        <article class="shell blog-article">
          <A href="/blog" class="back-link">
            ← All articles
          </A>

          <header class="blog-article__head">
            <div class="blog-article__meta">
              <span class="blog-article__date mono">{formatBlogDate(a().date)}</span>
              <For each={a().tags}>{(t) => <span class="tag">{t}</span>}</For>
            </div>
            <h1 class="blog-article__title">{a().title}</h1>
            <p class="blog-article__excerpt">{a().excerpt}</p>
          </header>

          <div class="blog-article__body">
            <BlogContent content={a().content} />
          </div>

          <aside class="blog-article__cta">
            <p class="blog-article__cta-lede">Try it on Wikipedia right now.</p>
            <div class="blog-article__cta-actions">
              <A href="/search" class="btn btn--primary">
                <IconSearch size={15} />
                Search whisk
              </A>
              <A href="/path" class="btn btn--ghost">
                <IconSpiral size={15} />
                Start a rabbit hole
              </A>
            </div>
          </aside>

          <Show when={relatedArticles(a().slug).length}>
            <section class="blog-article__related">
              <h2 class="blog-article__related-title">Keep reading</h2>
              <div class="blog__grid blog__grid--related">
                <For each={relatedArticles(a().slug)}>
                  {(r) => (
                    <A href={`/blog/${r.slug}`} class="blog-card" data-cluster={r.cluster}>
                      <span class="blog-card__date mono">{formatBlogDate(r.date)}</span>
                      <h3 class="blog-card__title">{r.title}</h3>
                      <p class="blog-card__excerpt">{r.excerpt}</p>
                    </A>
                  )}
                </For>
              </div>
            </section>
          </Show>

          <nav class="blog-article__nav" aria-label="More articles">
            <Show when={newer()} fallback={<span />}>
              {(n) => (
                <A href={`/blog/${n().slug}`} class="blog-article__navlink">
                  <span class="blog-article__navdir mono">← Newer</span>
                  <span class="blog-article__navtitle">{n().title}</span>
                </A>
              )}
            </Show>
            <Show when={older()} fallback={<span />}>
              {(o) => (
                <A href={`/blog/${o().slug}`} class="blog-article__navlink blog-article__navlink--next">
                  <span class="blog-article__navdir mono">
                    Older <IconArrow size={13} />
                  </span>
                  <span class="blog-article__navtitle">{o().title}</span>
                </A>
              )}
            </Show>
          </nav>
        </article>
      )}
    </Show>
  );
}
