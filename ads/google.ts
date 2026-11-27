// Export a Google Ads Editor import for the whisk daily promo: one Search
// campaign / ad group with a Responsive Search Ad + phrase-match keywords.
//
//   npm run ads:google      → ads/out/google-rsa.csv, ads/out/google-keywords.csv
//
// Import in Google Ads Editor (Account → Import → From file), review, then Post.
// Everything lands paused. Search is where intent lives ("wikipedia game");
// for Display / Demand Gen, upload the landscape + square PNGs from ads:render.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOOGLE_KEYWORDS, GOOGLE_RSA, copyViolations, landingUrl } from './copy.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
const CAMPAIGN = 'whisk daily promo';
const AD_GROUP = 'wikipedia game';

const bad = copyViolations();
if (bad.length) {
  console.error(`Copy over limits:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}

const csv = (rows: string[][]) =>
  rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n') + '\n';

const finalUrl = landingUrl({ source: 'google', medium: 'cpc', content: 'rsa' });

const rsaHeader = [
  'Campaign',
  'Ad group',
  'Ad type',
  ...GOOGLE_RSA.headlines.map((_, i) => `Headline ${i + 1}`),
  ...GOOGLE_RSA.descriptions.map((_, i) => `Description ${i + 1}`),
  'Path 1',
  'Path 2',
  'Final URL',
  'Status',
];
const rsaRow = [
  CAMPAIGN,
  AD_GROUP,
  'Responsive search ad',
  ...GOOGLE_RSA.headlines,
  ...GOOGLE_RSA.descriptions,
  GOOGLE_RSA.path1,
  GOOGLE_RSA.path2,
  finalUrl,
  'Paused',
];

const kwRows = [
  ['Campaign', 'Ad group', 'Keyword', 'Criterion Type', 'Status'],
  ...GOOGLE_KEYWORDS.map((k) => [CAMPAIGN, AD_GROUP, k, 'Phrase', 'Paused']),
];

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'google-rsa.csv'), csv([rsaHeader, rsaRow]));
writeFileSync(join(OUT, 'google-keywords.csv'), csv(kwRows));
console.log(`✓ ads/out/google-rsa.csv (${GOOGLE_RSA.headlines.length} headlines, ${GOOGLE_RSA.descriptions.length} descriptions)`);
console.log(`✓ ads/out/google-keywords.csv (${GOOGLE_KEYWORDS.length} phrase-match keywords)`);
console.log(`  Final URL: ${finalUrl}`);
