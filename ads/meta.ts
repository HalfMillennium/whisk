// Push the whisk daily promo to Meta (Facebook + Instagram) via the Marketing API.
//
//   npm run ads:meta                     # DRY RUN: prints every request, sends nothing
//   npm run ads:meta -- --apply          # creates campaign → ad set → creatives → ads
//
// Everything is created PAUSED. Nothing spends until you review it in Ads
// Manager and switch it on yourself. Run `npm run ads:render` first so the
// square PNGs exist in ads/out/.
//
// Env (see ads/README.md for how to get each one):
//   META_ACCESS_TOKEN   system-user token with ads_management (+ pages_read_engagement)
//   META_AD_ACCOUNT_ID  e.g. act_1234567890 (the "act_" prefix is added if missing)
//   META_PAGE_ID        the whisk Facebook Page the ads run as
//   META_APP_SECRET     optional; adds appsecret_proof if your app requires it
//   META_API_VERSION    optional; defaults to DEFAULT_VERSION below

import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { FEATURED_PAIRS, META_ALT_PRIMARY, CAMPAIGN_SLUG, LANDING_PATH, SITE, metaCopy, pairSlug } from './copy.ts';
import { FORMATS } from './creative.ts';

const DEFAULT_VERSION = 'v24.0';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');

const { values } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    'daily-budget': { type: 'string', default: '10' }, // account currency, major units
    countries: { type: 'string', default: 'US,CA,GB,IE,AU,NZ' },
    'age-min': { type: 'string', default: '18' },
    pairs: { type: 'string', default: String(FEATURED_PAIRS.length) }, // how many featured pairs → ads
    cta: { type: 'string', default: 'PLAY_GAME' }, // fall back to LEARN_MORE if Meta rejects it
    name: { type: 'string', default: `whisk daily promo ${new Date().toISOString().slice(0, 10)}` },
  },
});

// ----------------------------------------------------------------- plan
const budget = Number(values['daily-budget']);
if (!Number.isFinite(budget) || budget <= 0) throw new Error('--daily-budget must be a positive number');
const countries = values.countries!.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
const pairs = FEATURED_PAIRS.slice(0, Math.max(1, Number(values.pairs)));
const { width, height } = FORMATS.square;

interface PlannedAd {
  slug: string;
  image: string;
  copy: ReturnType<typeof metaCopy>;
}
const ads: PlannedAd[] = pairs.map((p) => ({
  slug: pairSlug(p),
  image: join(OUT, `${pairSlug(p)}_square_${width}x${height}.png`),
  copy: metaCopy(p),
}));
// One extra ad per alternate primary text, reusing the first pair's image — a
// cheap copy test against the pair-specific text.
META_ALT_PRIMARY.forEach((text, i) =>
  ads.push({ ...ads[0], slug: `${ads[0].slug}-alt${i + 1}`, copy: { ...ads[0].copy, primaryText: text } }),
);

const missing = ads.filter((a) => !existsSync(a.image)).map((a) => a.image);
if (missing.length) {
  console.error(`Missing creatives — run \`npm run ads:render\` first:\n  ${[...new Set(missing)].join('\n  ')}`);
  process.exit(1);
}

// Meta substitutes these macros at click time, so every ad reports itself.
const URL_TAGS =
  'utm_source={{site_source_name}}&utm_medium=paid_social' +
  `&utm_campaign=${CAMPAIGN_SLUG}&utm_content={{ad.name}}`;
// Base link without UTMs — url_tags appends them.
const LINK = new URL(LANDING_PATH, SITE).toString();

// ------------------------------------------------------------------ api
const env = (k: string) => process.env[k]?.trim() || '';
const token = env('META_ACCESS_TOKEN');
const rawAccount = env('META_AD_ACCOUNT_ID');
const account = rawAccount ? (rawAccount.startsWith('act_') ? rawAccount : `act_${rawAccount}`) : 'act_<META_AD_ACCOUNT_ID>';
const pageId = env('META_PAGE_ID') || '<META_PAGE_ID>';
const version = env('META_API_VERSION') || DEFAULT_VERSION;
const appSecret = env('META_APP_SECRET');
const apply = values.apply!;

if (apply) {
  const need = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID'].filter((k) => !env(k));
  if (need.length) {
    console.error(`--apply needs: ${need.join(', ')}`);
    process.exit(1);
  }
}

type Params = Record<string, unknown>;
let fakeId = 0;

async function graph(method: 'GET' | 'POST', path: string, params: Params = {}): Promise<any> {
  const shown = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, k === 'bytes' ? `<${String(v).length} base64 chars>` : v]),
  );
  if (!apply) {
    console.log(`\n${method} /${version}/${path}\n${JSON.stringify(shown, null, 2)}`);
    return { id: `DRY_RUN_${++fakeId}`, images: { x: { hash: `DRY_RUN_HASH_${fakeId}` } } };
  }
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  body.set('access_token', token);
  if (appSecret) body.set('appsecret_proof', createHmac('sha256', appSecret).update(token).digest('hex'));

  const url = `https://graph.facebook.com/${version}/${path}`;
  const res =
    method === 'GET'
      ? await fetch(`${url}?${body}`)
      : await fetch(url, { method, body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new Error(
      `Meta ${method} ${path} failed (${res.status}): ${e.message ?? 'unknown error'}` +
        (e.error_user_title ? ` — ${e.error_user_title}: ${e.error_user_msg}` : '') +
        (e.fbtrace_id ? ` [fbtrace_id ${e.fbtrace_id}]` : ''),
    );
  }
  return json;
}

// ------------------------------------------------------------------ run
console.log(
  `${apply ? 'APPLYING' : 'DRY RUN (pass --apply to create)'} — ${ads.length} ads, ` +
    `${budget}/day, ${countries.join(' ')}, all PAUSED`,
);

const created: Record<string, unknown> = { account, version, createdAt: new Date().toISOString() };

if (apply) {
  const acct = await graph('GET', account, { fields: 'name,currency,account_status,timezone_name' });
  console.log(`Ad account: ${acct.name} (${acct.currency}, ${acct.timezone_name}), status ${acct.account_status}`);
  if (acct.account_status !== 1) throw new Error('Ad account is not ACTIVE (account_status != 1) — fix billing/review first');
  created.currency = acct.currency;
}

// 1) Images → hashes (dedupe: alt-copy ads share an image).
const hashes = new Map<string, string>();
for (const img of new Set(ads.map((a) => a.image))) {
  const res = await graph('POST', `${account}/adimages`, { bytes: readFileSync(img).toString('base64') });
  hashes.set(img, (Object.values(res.images) as { hash: string }[])[0].hash);
}

// 2) Campaign. special_ad_categories is required even when empty — a puzzle game
//    is not housing/employment/credit/politics, so it's [].
const campaign = await graph('POST', `${account}/campaigns`, {
  name: values.name,
  objective: 'OUTCOME_TRAFFIC',
  buying_type: 'AUCTION',
  special_ad_categories: [],
  is_adset_budget_sharing_enabled: false,
  status: 'PAUSED',
});
created.campaignId = campaign.id;

// 3) Ad set. Broad + Advantage+ audience: for a cheap, broad-appeal game Meta's
//    delivery usually beats hand-picked interests. Budget is in minor units
//    (cents) — assumes a 2-decimal currency like USD/EUR/GBP.
const adset = await graph('POST', `${account}/adsets`, {
  name: `${values.name} · broad`,
  campaign_id: campaign.id,
  daily_budget: Math.round(budget * 100),
  billing_event: 'IMPRESSIONS',
  optimization_goal: 'LINK_CLICKS',
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  destination_type: 'WEBSITE',
  targeting: {
    geo_locations: { countries },
    age_min: Number(values['age-min']),
    targeting_automation: { advantage_audience: 1 },
  },
  status: 'PAUSED',
});
created.adsetId = adset.id;

// 4) Creative + ad per variant.
const adIds: Record<string, { creativeId: string; adId: string }> = {};
for (const a of ads) {
  const creative = await graph('POST', `${account}/adcreatives`, {
    name: `whisk daily · ${a.slug}`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        link: LINK,
        message: a.copy.primaryText,
        name: a.copy.headline,
        description: a.copy.description,
        image_hash: hashes.get(a.image),
        call_to_action: { type: values.cta, value: { link: LINK } },
      },
    },
    url_tags: URL_TAGS,
  });
  const ad = await graph('POST', `${account}/ads`, {
    name: `daily-${a.slug}`,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: 'PAUSED',
  });
  adIds[a.slug] = { creativeId: creative.id, adId: ad.id };
}
created.ads = adIds;

if (apply) {
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `meta-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(created, null, 2));
  console.log(`\nCreated (all PAUSED). IDs saved to ${file}`);
  console.log(`Review: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.slice(4)}`);
} else {
  console.log('\nDry run complete — nothing was sent.');
}
