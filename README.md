# whisk

A discovery engine for Wikipedia. Where Wikipedia answers *"what is this?"*, whisk answers *"what else is connected to this, and what should I read next?"* — natural-language search that returns clustered results (People / Events / Places / Concepts / Deep cuts), rabbit-hole trails between topics, an article intelligence dossier with source-quality signals, and local collections for saving what you find.

whisk never competes with Wikipedia as an encyclopedia: every page links back to its source, and all content is attributed (Wikipedia, CC BY-SA 4.0).

## Stack

- [SolidJS](https://www.solidjs.com) + [@solidjs/router](https://github.com/solidjs/solid-router), TypeScript, Vite
- Hand-written CSS on an OKLCH token system (`src/styles/tokens.css`) — light "reading room" and dark "apothecary glass" themes
- Wikipedia / Wikidata public APIs (no backend); collections persist in `localStorage`
- Optional AI enrichment via the OpenAI API — the app is fully functional without it

## Develop

```bash
npm install
npm run dev       # Vite dev server → http://localhost:5173
npm run test      # vitest
npm run build     # tsc + vite build → dist/
npm run preview   # serve the production build
```

### Optional AI enrichment

Create a `.env` with:

```
VITE_OPENAI_API_KEY=sk-...
VITE_OPENAI_MODEL=gpt-4o-mini   # optional
```

This enables sharper query expansion, cluster labels, "why matched" reasons, and trail narration. **The key ships in the client bundle** — local use only; put a proxy in front before deploying publicly.

## Design

Product and visual direction live in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md). The short version: archival, inquisitive, precise — index-card restraint, herbarium green + brass, Fraunces/Inter/JetBrains Mono, both themes WCAG 2.1 AA.
