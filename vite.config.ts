import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import { runAi, type AiBody } from './api/ai.ts'

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

export default defineConfig({
  plugins: [solid(), aiDevProxy()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
} as any)
