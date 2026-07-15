// Deterministic content-safety filter, shared by the server-side trends proxy
// (api/trends.ts) and client features that surface real-world content (e.g.
// "On this day"). Raw feeds routinely include violent crime, disasters, death,
// and explicit content — none of which belong seeding a "fall down a rabbit
// hole" experience. Fully independent of the optional AI layer, so the
// guarantee holds with no API key.
//
// Lives in src/lib (not api/) because client modules import it at runtime: a
// value import of api/trends.ts would make Vite request /api/trends.ts, which
// the /api/trends dev middleware prefix-matches and answers with JSON —
// breaking the importing route's whole module graph in dev.
// Word boundaries matter: `\bfire\b` must not match "fireworks".

const BLOCKLIST = new RegExp(
  [
    // violence / crime
    'shoot(ing|er|out)?', 'gunm(a|e)n', 'gunfire', '\\bshot\\b', '\\bguns?\\b',
    'stab(bing|bed)?', 'murder', 'homicide', 'manslaughter', 'kill(ed|ing|er)?',
    'massacre', 'assault', '\\brape(d|s|ist)?\\b', 'molest', 'kidnap', 'abduct',
    'hostage', 'terror(ism|ist)?', 'bomb(ing|er)?', 'explos(ion|ive)',
    'weapon', '\\briot', 'assassinat', 'execution', 'executed', 'behead',
    '\\bgang\\b', 'lynch', 'brawl', 'shooter',
    // death
    '\\bdead\\b', '\\bdeath', '\\bdies\\b', '\\bdied\\b', 'fatal', 'fatalit',
    'obituary', 'deceased', 'corpse',
    // disasters / accidents
    'earthquake', 'wildfire', '\\bfire\\b', '\\bblaze\\b', '\\bflood', 'hurricane',
    'tornado', 'cyclone', 'typhoon', 'tsunami', 'landslide', 'mudslide',
    'avalanche', '\\bstorm\\b', '\\bcrash', 'collapse', 'derail', 'disaster',
    'catastrophe', 'evacuat', 'wreck',
    // self-harm
    'suicide', 'overdose', 'self[-\\s]?harm',
    // sexual / explicit
    '\\bporn', 'pornograph', '\\bnude', '\\bnsfw\\b', 'sex tape', 'onlyfans',
    '\\bxxx\\b', 'explicit', 'prostitut',
    // drugs / illegal
    'cartel', 'cocaine', 'heroin', 'fentanyl', 'traffick', 'smuggl',
    // hate
    '\\bnazi', 'genocide', 'ethnic cleansing',
  ].join('|'),
  'i',
);

export interface SafetyCheckable {
  title: string;
  newsTitles?: string[];
}

/** True if an item is safe to surface (title + associated headlines clear the blocklist). */
export function isSafeTrend(t: SafetyCheckable): boolean {
  const hay = [t.title, ...(t.newsTitles ?? [])].join(' ');
  return !BLOCKLIST.test(hay);
}

/** Drop items flagged by the deterministic safety filter. */
export function cleanTrends<T extends SafetyCheckable>(items: T[]): T[] {
  return items.filter(isSafeTrend);
}
