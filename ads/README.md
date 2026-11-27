# whisk daily — promo ads

Tooling for paid promotion of [whisk.fyi/daily](https://whisk.fyi/daily). It renders creatives in whisk's own visual language, holds copy checked against each platform's character limits, and pushes ads to Meta or exports them for Google Ads. **Everything is created paused.** Nothing spends until you switch it on in the platform UI.

```bash
npm run ads:render                 # creatives → ads/out/*.png (needs Playwright, see below)
npm run ads:meta                   # Meta: dry run, prints every API call
npm run ads:meta -- --apply        # Meta: create campaign → ad set → creatives → ads (PAUSED)
npm run ads:google                 # Google Ads Editor CSVs → ads/out/
```

| File | What it is |
| --- | --- |
| `copy.ts` | Featured pairs, Meta + Google copy, UTM landing URLs, limit checks |
| `creative.ts` | The ad as an HTML page: Poolsuite window, jade + amber, Baloo 2 / Silkscreen |
| `render.ts` | Screenshots each pair × format to PNG |
| `meta.ts` | Marketing API pusher (dry run by default) |
| `google.ts` | Responsive Search Ad + keyword CSVs for Google Ads Editor |
| `ads.test.ts` | Featured pairs exist in `DAILY_PAIRS`, copy fits limits, escaping |

## Creatives

`render.ts` produces four sizes for each featured pair:

| Format | Size | Placement |
| --- | --- | --- |
| `square` | 1080×1080 | Facebook / Instagram feed (uploaded by `ads:meta`) |
| `portrait` | 1080×1350 | Feed 4:5, which takes more screen space on mobile |
| `story` | 1080×1920 | Stories / Reels / TikTok; the top 14% and bottom 20% are left clear for platform UI |
| `landscape` | 1200×628 | Google Display / Demand Gen, link previews |

Options: `--today` renders today's real puzzle with a `TODAY · #137` label. `--pair "From:To"` renders any pair (repeatable). `--format square` limits the formats. `--html` also writes the HTML so you can tweak it in a browser.

**Why no Wikipedia photos:** most article images are CC BY-SA or non-free, and those licenses would require per-image attribution inside a paid ad. The creative is typographic, so it carries no licensing risk.

**Playwright:** `npm i -D playwright && npx playwright install chromium`. It's deliberately not a project dependency, so Vercel builds stay lean. The fonts load from Google Fonts at render time, so rendering needs network access.

### Featured pair vs. today's puzzle

The evergreen creatives feature a curated pair, e.g. *Napoleon → Sushi*. That pair is always in `DAILY_PAIRS` (enforced by tests), but the landing page shows *today's* puzzle. The copy says "new puzzle every day" so the click doesn't feel like a bait-and-switch. If you want an exact match, run `ads:render --today` daily and swap the image. Be aware that swapping creative every day resets Meta's learning phase, so the evergreen ads are the better default for paid spend. `--today` is ideal for organic posts.

## Meta (Facebook + Instagram)

Whisk is a **single advertiser promoting itself**, so you don't need the agency setup: no child Business Managers, no `end_advertiser` / `media_agency` fields, and no Advanced Access. Standard Access to `ads_management` covers ad accounts your own business owns.

One-time setup:

1. **Business portfolio** (business.facebook.com) owning the whisk **Facebook Page** and an **ad account** with a payment method. Also verify the `whisk.fyi` domain there (Brand safety → Domains).
2. **Meta app** (developers.facebook.com, type *Business*). Add the *Marketing API* product and connect the app to the business portfolio.
3. **System user** (Business settings → Users → System users → Add, role Admin). Assign it the ad account with *Manage campaigns* and the Page. Generate a token for your app with `ads_management`, `ads_read`, `pages_show_list`, `pages_read_engagement` and `pages_manage_ads`. System-user tokens don't expire on a timer, so treat this one like a password.
4. Put the values in `.env.local` (already gitignored), or export them in your shell:

   ```
   META_ACCESS_TOKEN=...
   META_AD_ACCOUNT_ID=act_...
   META_PAGE_ID=...
   # META_APP_SECRET=...      # only if the app enforces appsecret_proof
   # META_API_VERSION=v24.0
   ```

   Then run `node --env-file=.env.local ads/meta.ts --apply`.

What `--apply` creates:

- **Campaign:** `OUTCOME_TRAFFIC`, `special_ad_categories: []`. A puzzle game isn't housing, employment, credit or politics, so no "Paid for by" disclaimer is needed.
- **Ad set:** a $10/day budget, set with `--daily-budget`, in minor units, so it assumes a 2-decimal currency. Targeting is US/CA/GB/IE/AU/NZ (`--countries`), 18+, with the Advantage+ audience on. It optimizes for link clicks.
- **One ad per featured pair** (square image, pair-specific copy), plus two more on the first pair's image that A/B-test alternate primary text.
- **Links:** every ad links to `whisk.fyi/daily` with `url_tags`: `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign=daily_promo&utm_content={{ad.name}}`.
- **Records:** the IDs are saved to `ads/out/meta-<timestamp>.json`.

Before you switch it on in Ads Manager: check the Advantage+ creative enhancements toggles (Meta may add music or overlays, or rewrite text), and add the 9:16 `story` PNG as a placement customization for Stories/Reels. If Meta rejects the `PLAY_GAME` button, rerun with `--cta LEARN_MORE`.

## Google Ads

No manager account (MCC) and no developer token are needed for one advertiser. `ads:google` writes `google-rsa.csv`, a Responsive Search Ad with 12 headlines and 4 descriptions, and `google-keywords.csv`, phrase-match terms such as *wikipedia game* and *wikiracing*. Import both in **Google Ads Editor** (Account → Import → From file), attach a budget, review, then post. Everything is marked Paused. For Display or Demand Gen, upload the `landscape` and `square` PNGs.

## Policy notes

- The creative says "not affiliated with Wikipedia". Keep it: whisk uses Wikipedia's name descriptively and must not imply endorsement. If Google flags "Wikipedia" in ad text as a trademark, drop those headlines. The rest of the copy stands alone.
- `/daily` loads AdSense. Paid traffic to AdSense pages is allowed, but you're responsible for its quality. Stick to placements where people click on purpose (feed and search), and keep an eye on AdSense invalid-traffic reports once ads are live.
- Optimizing for link clicks is the simple start. Once there's volume, add the Meta Pixel and a `puzzle_completed` custom event, then optimize for players instead of clicks.
