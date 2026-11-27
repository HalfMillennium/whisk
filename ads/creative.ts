// Static ad creative for the whisk daily promo, as a self-contained HTML page
// that ads/render.ts screenshots into PNGs. Visual language is lifted from the
// live site (src/styles/tokens.css + the home "Poolsuite window"): warm cream
// desktop, ink hairlines, jade primary, Baloo 2 / Nunito / Silkscreen / Zilla
// Slab. Deliberately typographic — no Wikipedia photos, which are often CC BY-SA
// or non-free and would need per-image attribution inside a paid ad.

import type { DailyPair } from '../src/lib/daily.ts';

export type AdFormat = 'square' | 'portrait' | 'story' | 'landscape';

/** Pixel sizes per placement (Meta feed 1:1 & 4:5, Stories/Reels 9:16, Google/link 1.91:1). */
export const FORMATS: Record<AdFormat, { width: number; height: number; use: string }> = {
  square: { width: 1080, height: 1080, use: 'Meta feed / Instagram feed (1:1)' },
  portrait: { width: 1080, height: 1350, use: 'Meta & Instagram feed (4:5)' },
  story: { width: 1080, height: 1920, use: 'Stories / Reels / TikTok (9:16)' },
  landscape: { width: 1200, height: 628, use: 'Google Display, Demand Gen, link previews (1.91:1)' },
};

// Exact Poolsuite title-bar glyphs from src/routes/Home.tsx. Decorative.
const ICON_CLOSE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOAQMAAAAlhr+SAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAAB1JREFUCNdjOMADQgYGIMRzAISYGYAIwoaIQ9QAAKYLB+eSH+asAAAAAElFTkSuQmCC';
const ICON_TV =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWBAMAAAA2mnEIAAAAHlBMVEUAAAD///////////////////////////////////8kfJuVAAAACXRSTlMAIO+/EK+gn7AFTmhBAAAATUlEQVQY02MAgZlACAQINoKDwWY0mgkBUwUYhGbCgCJDZApUndhkhpkCUDbLJKA2XBBKobKppl7TgQHq4JkMloVQtvsMFDczRkKZygIAruY/K5IcNPMAAAAASUVORK5CYII=';
const ICON_CONTRACT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWAQMAAAD+ev54AAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABdJREFUCNdjYGBmwIH/gDEu8B+McWoHALXwBCGzcXiRAAAAAElFTkSuQmCC';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;600;700;800&family=Silkscreen:wght@400;700&family=Zilla+Slab:wght@700&display=block';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface CreativeOptions {
  pair: DailyPair;
  format: AdFormat;
  /** Small pixel label above the headline, e.g. "TODAY · #137". */
  eyebrow?: string;
  cta?: string;
}

/**
 * Layout knobs per format. Everything is sized in px for a fixed canvas, then
 * the headline is shrink-to-fit by a tiny script (long titles like "Wolfgang
 * Amadeus Mozart" must never overflow the window).
 */
const LAYOUT: Record<
  AdFormat,
  {
    pad: string; // desktop padding around the window (story keeps Reels UI safe zones clear)
    head: number; // max headline px
    sub: number;
    crumb: number;
    cta: number;
    gap: number;
    bodyPad: string;
    stops: number; // "?" stops between start and goal
    oneLineHead: boolean;
  }
> = {
  square: { pad: '70px', head: 132, sub: 34, crumb: 22, cta: 34, gap: 34, bodyPad: '56px 56px', stops: 2, oneLineHead: false },
  portrait: { pad: '90px 70px', head: 140, sub: 36, crumb: 23, cta: 36, gap: 44, bodyPad: '72px 56px', stops: 2, oneLineHead: false },
  // Top ~14% and bottom ~20% are covered by Stories/Reels UI — keep them empty.
  story: { pad: '290px 56px 400px', head: 176, sub: 46, crumb: 28, cta: 46, gap: 70, bodyPad: '80px 48px', stops: 2, oneLineHead: false },
  landscape: { pad: '34px 44px', head: 100, sub: 26, crumb: 16, cta: 26, gap: 24, bodyPad: '30px 40px', stops: 3, oneLineHead: true },
};

export function renderCreativeHtml(opts: CreativeOptions): string {
  const { pair, format } = opts;
  const { width, height } = FORMATS[format];
  const L = LAYOUT[format];
  const eyebrow = opts.eyebrow ?? 'WHISK DAILY';
  const cta = opts.cta ?? 'Play today’s puzzle';

  const from = esc(pair.from);
  const to = esc(pair.to);
  // Baloo 2 has no → glyph; an SVG keeps the arrow's weight matched to the type.
  const arrow =
    '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12h16M13.5 6l6 6-6 6"/></svg>';
  const headline = L.oneLineHead
    ? `<span class="fit">${from} ${arrow} <em>${to}.</em></span>`
    : `<span class="fit">${from}</span><span class="fit">${arrow} <em>${to}.</em></span>`;

  const stops = Array.from({ length: L.stops }, () => `<span class="sep">→</span><span class="crumb crumb--q">?</span>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
  :root{
    --bg:#F4ECDE; --surface:#FFFDF9; --surface-2:#ECDECB; --ink:#241C1C; --ink-2:#6F5F57;
    --primary:#159C89; --primary-ink:#0B6E60; --primary-soft:#CDE9E3; --accent:#F2A93B; --border:#E6D8C4;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${width}px;height:${height}px;overflow:hidden}
  body{
    background:var(--bg); color:var(--ink); font-family:'Nunito',system-ui,sans-serif;
    display:flex; flex-direction:column; padding:${L.pad};
    -webkit-font-smoothing:antialiased;
  }
  /* faint desktop dither so the cream reads as a surface, not a void */
  body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.5;
    background-image:radial-gradient(rgba(36,28,28,.07) 1px,transparent 1.2px);background-size:14px 14px}
  .window{position:relative;flex:1;display:flex;flex-direction:column;background:var(--surface);
    border:2px solid var(--ink);border-radius:10px;padding:9px;
    box-shadow:0 18px 60px -14px rgba(90,40,40,.38),0 3px 8px rgba(90,40,40,.12)}
  .titlebar{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
  .btns{display:flex;gap:5px}
  .btn{display:grid;place-items:center;width:28px;height:28px;border-radius:3px}
  .btn img{image-rendering:pixelated}
  .btn--tv{background:var(--ink)}
  .wordmark{font-family:'Zilla Slab',serif;font-weight:700;font-size:28px;line-height:22px;letter-spacing:-1.5px;
    text-transform:uppercase;padding-right:6px}
  .body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${L.gap}px;
    text-align:center;padding:${L.bodyPad};border:2px solid var(--ink);border-bottom-width:4px;border-radius:6px;
    background:linear-gradient(180deg,var(--primary-soft) 0%,var(--surface) 62%)}
  .eyebrow{font-family:'Silkscreen',monospace;font-size:${Math.round(L.crumb * 0.95)}px;letter-spacing:.14em;color:var(--primary-ink)}
  h1{font-family:'Baloo 2',sans-serif;font-weight:800;line-height:.98;letter-spacing:-.015em;width:100%;
    display:flex;flex-direction:column;align-items:center}
  h1 .fit{display:block;white-space:nowrap;font-size:${L.head}px}
  h1 em{font-style:normal;color:var(--primary-ink)}
  h1 .arrow{color:var(--accent);width:.72em;height:.72em;vertical-align:-.04em;margin-right:.08em}
  .sub{font-size:${L.sub}px;line-height:1.3;color:var(--ink-2);max-width:24ch;font-weight:600}
  .sub b{color:var(--ink);font-weight:800}
  .trail{display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:${Math.round(L.crumb * 0.5)}px}
  .crumb{font-family:'Silkscreen',monospace;font-size:${L.crumb}px;text-transform:uppercase;white-space:nowrap;
    padding:${Math.round(L.crumb * 0.3)}px ${Math.round(L.crumb * 0.75)}px;border-radius:999px;
    border:2px solid var(--ink);background:var(--surface)}
  .crumb--start{background:var(--primary-soft);color:var(--primary-ink)}
  .crumb--goal{background:var(--accent);color:var(--ink)}
  .crumb--q{border-style:dashed;color:var(--ink-2);background:transparent}
  .sep{color:var(--ink-2);font-size:${L.crumb}px}
  .cta-row{display:flex;flex-direction:column;align-items:center;gap:${Math.round(L.gap * 0.45)}px}
  .cta{display:inline-flex;align-items:center;gap:.4em;font-weight:800;font-size:${L.cta}px;
    padding:.5em 1.1em;border-radius:8px;border:2px solid var(--ink);border-bottom-width:5px;
    background:var(--primary);color:var(--ink);box-shadow:0 4px 14px -6px rgba(90,40,40,.4)}
  .url{font-family:'Silkscreen',monospace;font-size:${Math.round(L.crumb * 0.9)}px;letter-spacing:.06em;color:var(--ink-2)}
  .foot{margin-top:${Math.round(L.gap * 0.5)}px;text-align:center;font-size:${Math.round(L.sub * 0.62)}px;color:var(--ink-2);font-weight:600}
  ${format === 'landscape' ? `.cta-row{flex-direction:row;gap:22px} .foot{display:none} .sub{max-width:none}` : ''}
</style></head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="btns" aria-hidden="true">
        <span class="btn"><img src="${ICON_CLOSE}" width="12" alt=""></span>
        <span class="btn btn--tv"><img src="${ICON_TV}" width="19" alt=""></span>
        <span class="btn"><img src="${ICON_CONTRACT}" width="14" alt=""></span>
      </div>
      <span class="wordmark">whisk</span>
    </div>
    <div class="body">
      <p class="eyebrow">✳ ${esc(eyebrow)} ✳</p>
      <h1>${headline}</h1>
      <p class="sub">Only the links on Wikipedia pages. <b>Fewest clicks wins.</b></p>
      <div class="trail" aria-hidden="true">
        <span class="crumb crumb--start">${from}</span>${stops}<span class="sep">→</span><span class="crumb crumb--goal">${to}</span>
      </div>
      <div class="cta-row">
        <span class="cta">${esc(cta)} <span aria-hidden="true">→</span></span>
        <span class="url">whisk.fyi/daily</span>
      </div>
    </div>
  </div>
  <p class="foot">Free · new puzzle every day · not affiliated with Wikipedia</p>
<script>
  // Shrink-to-fit: headline lines and the trail must never overflow the window.
  window.__fit = async () => {
    await document.fonts.ready;
    const box = document.querySelector('.body');
    const max = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) * 2;
    const lines = [...document.querySelectorAll('h1 .fit')];
    let size = parseFloat(getComputedStyle(lines[0]).fontSize);
    while (size > 24 && lines.some((l) => l.scrollWidth > max)) {
      size -= 2;
      lines.forEach((l) => (l.style.fontSize = size + 'px'));
    }
    const trail = document.querySelector('.trail');
    let c = parseFloat(getComputedStyle(trail.firstElementChild).fontSize);
    while (c > 10 && trail.scrollWidth > max) {
      c -= 1;
      trail.querySelectorAll('.crumb,.sep').forEach((el) => (el.style.fontSize = c + 'px'));
    }
    // Drop "?" stops (keep at least one) if the trail still overflows.
    while (trail.scrollWidth > max && trail.querySelectorAll('.crumb--q').length > 1) {
      const q = trail.querySelector('.crumb--q');
      q.previousElementSibling.remove();
      q.remove();
    }
    return true;
  };
</script>
</body></html>`;
}
