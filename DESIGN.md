# Design

Visual system for **whisk**. Register: product. Mood: *a lamplit archive reading room — ink on off-white index cards, brass fittings, herbarium-green cloth bindings.* Warmth and identity live in the green primary, the brass accent, and the serif type — never in a cream body.

## Theme

Two themes, both AA. **Light "reading room"** is default (a research tool is read for long stretches; readability wins). **Dark "apothecary glass"** — near-black green surfaces where the green *glows* — is a first-class toggle, especially fitting for the rabbit-hole map. Tokens in `src/styles/tokens.css` drive both; nothing is hard-coded.

## Color (OKLCH)

- **Primary — herbarium green** (`--primary`, seed hue 158°). Links, primary actions, current selection, path spine. `oklch(0.43 0.088 158)` light / `oklch(0.78 0.105 158)` dark.
- **Accent — brass** (`--accent`, hue ~72°). *Meaning only:* the interestingness meter, "deep cut" / weird-mode markers, active control pills, highlights. Never decoration.
- **Neutrals** — a whisper of green (chroma ≤0.007), never warm-cream. `--bg` off-white, `--surface` pure white cards that lift, `--surface-2` for panels/toolbars (second neutral layer).
- **Ink ramp** — `--ink` / `--ink-2` / `--ink-3`. Body and small meta use `--ink`/`--ink-2` (≥4.5:1); `--ink-3` is for large or decorative text only.
- **Semantic** — `--good` (confirmed/well-sourced), `--warn` (dispute/needs-citation), `--danger` (errors). Cluster types and dispute flags also carry icons/labels — color is never the only signal.

Strategy: **Restrained+** — tinted neutrals + one green primary, with brass as a second meaning-bearing role for the interestingness system.

## Typography

Contrast-axis pairing (not two sans):
- **Fraunces** (serif) — display headings, article/dossier reading surfaces, the wordmark. Carries the literary-archival voice.
- **Inter** (sans) — all UI: labels, buttons, cards, controls, body chrome.
- **JetBrains Mono** — meta and data: scores, pageviews, dates, cluster counts, "why matched" tags, the eyebrow.

Fixed rem scale, ratio ~1.2 (`--text-xs`…`--text-3xl`). Home hero is the one `clamp()` display moment (≤ ~5rem). Prose capped at 68ch (`--maxw-prose`).

## Components

Index-card language, not SaaS cards. Every interactive element ships all states: default / hover / focus-visible / active / disabled / loading / error.
- **CommandSearch** — the hero affordance: large command-bar input with example-prompt pills.
- **ResultCard** — index-card: title (serif), description, a mono "why matched" line, key facts row (time · place · categories), and a brass interestingness meter. Not an identical-grid card; sizing and emphasis vary by rank.
- **ClusterTabs** — People / Events / Places / Concepts / Deep cuts, with counts.
- **IntelligencePanel** — right-rail research dossier: facts, entities, related rabbit holes, source-quality signals (citations, last edited, protection, dispute templates).
- **RabbitHoleGraph** — hand-built SVG "constellation / subway map": nodes = pages, green spine = jumps, brass glow on the current node.
- **ControlPill bar** — Weirder · Shorter · Historical · People · Places · Timeline.
- **SaveDrawer** — slide-in for saving to collections.
- Loading = **skeletons** (never center spinners). Empty states **teach** the interface.

## Motion

150–250ms, state-driven (`--dur-1..3`, `--ease-out-quart`). Card lists stagger on entrance; the rabbit-hole path draws its spine and pops nodes in sequence (enhancing already-visible content — never gating visibility on the animation). No orchestrated page-load choreography. Every animation has a `prefers-reduced-motion` crossfade/instant fallback (global rule in `base.css`).

## Layout

Structural responsiveness: search results collapse the right rail under the cards; the app shell's nav collapses on narrow screens. `repeat(auto-fit, minmax(…))` for the result grid. Semantic z-index scale in tokens (dropdown → sticky → drawer → modal → toast → tooltip); no magic 9999s.
