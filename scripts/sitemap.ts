// Build-time sitemap + robots generator. Reads the blog articles so every new
// entry in src/lib/blog/articles.ts automatically appears in the sitemap — no
// manual step. Used by the Vite plugin in vite.config.ts (emitted into dist/ on
// build, served live in dev).

import { articles } from '../src/lib/blog/articles.ts'

type Route = { path: string; changefreq: string; priority: string }

// Curated non-article routes worth indexing (primary nav destinations).
const STATIC_ROUTES: Route[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/search', changefreq: 'monthly', priority: '0.6' },
  { path: '/path', changefreq: 'monthly', priority: '0.6' },
]

/** Absolute site origin, no trailing slash. */
export function siteUrl(): string {
  // 1) Explicit override (use this for a custom production domain).
  const explicit = process.env.SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  // 2) Vercel provides the production domain at build time, zero-config.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`
  // 3) Local/dev fallback — replaced automatically on any Vercel deploy.
  return 'http://localhost:5173'
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Newest article date — used as lastmod for the static/index pages. */
function latestArticleDate(): string {
  return articles.reduce((max, a) => (a.date > max ? a.date : max), '1970-01-01')
}

export function buildSitemap(): string {
  const base = siteUrl()
  const latest = latestArticleDate()

  const entries = [
    ...STATIC_ROUTES.map((r) => ({
      loc: base + r.path,
      lastmod: latest,
      changefreq: r.changefreq,
      priority: r.priority,
    })),
    ...articles.map((a) => ({
      loc: `${base}/blog/${a.slug}`,
      lastmod: a.date,
      changefreq: 'yearly',
      priority: '0.7',
    })),
  ]

  const body = entries
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${xml(u.loc)}</loc>\n` +
        `    <lastmod>${u.lastmod}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        `  </url>`,
    )
    .join('\n')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  )
}

export function buildRobots(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl()}/sitemap.xml\n`
}
