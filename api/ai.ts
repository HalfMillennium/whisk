/// <reference types="node" />
// Server-side OpenAI proxy. The API key lives ONLY here (process.env, never a
// VITE_ var), so it is never shipped to the browser. The client posts
// { system, user } to /api/ai and gets back { content } — the raw JSON string
// the model produced. All prompt logic and fallbacks stay in src/lib/ai.ts.
//
// On Vercel this file is a Serverless Function. Locally, the dev middleware in
// vite.config.ts calls runAi() directly so `npm run dev` behaves identically.

export type AiBody = { system?: string; user?: string };
export type AiResult = { status: number; json: unknown };

export async function runAi(body: AiBody): Promise<AiResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: 503, json: { error: 'ai_disabled' } };

  const { system, user } = body ?? {};
  if (!system || !user) return { status: 400, json: { error: 'bad_request' } };

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  // Lazy import so the SDK only loads when a call actually fires (and so it is
  // never pulled into the client build via the vite config import).
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = res.choices[0]?.message?.content ?? null;
    return { status: 200, json: { content } };
  } catch (err) {
    return { status: 502, json: { error: 'upstream', detail: String(err) } };
  }
}

// Vercel Node serverless entrypoint. Typed loosely to avoid a hard dependency
// on @vercel/node; the runtime provides Node-style req/res.
export default async function handler(
  req: { method?: string; body?: unknown },
  res: { status: (code: number) => { json: (data: unknown) => void } },
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const { status, json } = await runAi((req.body as AiBody) ?? {});
  res.status(status).json(json);
}
