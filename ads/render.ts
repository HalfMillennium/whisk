// Render ad creatives to PNG.
//
//   npm run ads:render                 # featured pairs × all formats → ads/out/
//   npm run ads:render -- --today      # today's actual puzzle only
//   npm run ads:render -- --pair "Napoleon:Sushi" --format square
//
// Needs Playwright + Chromium: `npm i -D playwright && npx playwright install chromium`
// (resolved via require so a globally installed Playwright also works).

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { todaysPuzzle, type DailyPair } from '../src/lib/daily.ts';
import { FEATURED_PAIRS, isInPool, pairSlug } from './copy.ts';
import { FORMATS, renderCreativeHtml, type AdFormat } from './creative.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');

const { values } = parseArgs({
  options: {
    today: { type: 'boolean', default: false },
    pair: { type: 'string', multiple: true },
    format: { type: 'string', multiple: true },
    html: { type: 'boolean', default: false }, // also write the .html for tweaking in a browser
  },
});

function parsePair(s: string): DailyPair {
  const [from, to] = s.split(':').map((x) => x.trim());
  if (!from || !to) throw new Error(`--pair must look like "From:To", got ${s}`);
  return { from, to };
}

const today = todaysPuzzle();
const pairs: { pair: DailyPair; eyebrow?: string }[] = values.today
  ? [{ pair: { from: today.from, to: today.to }, eyebrow: `TODAY · #${today.number}` }]
  : (values.pair?.map(parsePair) ?? FEATURED_PAIRS).map((pair) => ({ pair }));

for (const { pair } of pairs) {
  if (!isInPool(pair)) console.warn(`! ${pair.from} → ${pair.to} is not in DAILY_PAIRS — the game will never serve it`);
}

const formats = (values.format ?? Object.keys(FORMATS)) as AdFormat[];
for (const f of formats) if (!(f in FORMATS)) throw new Error(`unknown --format ${f}`);

const require = createRequire(import.meta.url);
// Untyped on purpose: playwright is an optional, ads-only tool, not a project dependency.
const { chromium } = require('playwright') as {
  chromium: { launch(): Promise<any> };
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const { pair, eyebrow } of pairs) {
    for (const format of formats) {
      const { width, height } = FORMATS[format];
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const html = renderCreativeHtml({ pair, format, eyebrow });
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluate(() => (window as unknown as { __fit: () => Promise<boolean> }).__fit());
      const base = `${pairSlug(pair)}_${format}_${width}x${height}`;
      await page.screenshot({ path: join(OUT, `${base}.png`), type: 'png' });
      if (values.html) writeFileSync(join(OUT, `${base}.html`), html);
      await page.close();
      console.log(`✓ ads/out/${base}.png`);
    }
  }
} finally {
  await browser.close();
}
