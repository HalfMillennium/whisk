import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import { runAi, type AiBody } from './api/ai.ts'
import { buildSitemap, buildRobots } from './scripts/sitemap.ts'

// Serves /api/ai during `npm run dev`, mirroring the Vercel Serverless Function
// so local behavior matches production. The key is read server-side (Node) from
// .env via loadEnv and never reaches the client bundle.
function aiDevProxy() {
  return {
    name: 'whisk-ai-dev-proxy',
    configureServer(server: any) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      if (env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY)
        process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
      if (env.OPENAI_MODEL && !process.env.OPENAI_MODEL)
        process.env.OPENAI_MODEL = env.OPENAI_MODEL

      server.middlewares.use('/api/ai', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        const send = (status: number, json: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(json))
        }
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const raw = chunks.length ? Buffer.concat(chunks).toString('utf8') : '{}'
          const { status, json } = await runAi(JSON.parse(raw) as AiBody)
          send(status, json)
        } catch {
          send(400, { error: 'bad_request' })
        }
      })
    },
  }
}

// Generates /sitemap.xml + /robots.txt from the blog articles: emitted into
// dist/ on build, and served live during `npm run dev`. Adding an article to
// src/lib/blog/articles.ts updates the sitemap automatically.
function sitemapPlugin() {
  return {
    name: 'whisk-sitemap',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = (req.url || '').split('?')[0]
        if (url === '/sitemap.xml') {
          res.setHeader('content-type', 'application/xml')
          res.end(buildSitemap())
          return
        }
        if (url === '/robots.txt') {
          res.setHeader('content-type', 'text/plain')
          res.end(buildRobots())
          return
        }
        next()
      })
    },
    generateBundle(this: any) {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap() })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots() })
    },
  }
}

export default defineConfig({
  plugins: [solid(), aiDevProxy(), sitemapPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
} as any)
