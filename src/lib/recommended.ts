// Curated evergreen searches and trails shown on the landing page the instant
// it paints, before (or instead of) live trending data. Keep entries in the
// house voice: oddly specific, a little sideways, always safe for a first
// impression.

export interface RecommendedTrail {
  label: string;
  from: string;
  to: string;
}

export const RECOMMENDED_SEARCHES: string[] = [
  'forgotten disasters',
  'ancient frauds',
  'scientists mocked for being right',
  'failed utopian communities',
  'abandoned cities',
  'unsolved codes and ciphers',
  'accidental discoveries',
  'lost expeditions',
  'strange border disputes',
  'hoaxes that fooled everyone',
];

// Exactly 6 trails to match MAX_HOLES in trends.ts — the static→live swap
// keeps the featured grid the same size, so nothing jumps when trends arrive.
export const RECOMMENDED_TRAILS: RecommendedTrail[] = [
  { label: 'Napoleon → Canning', from: 'Napoleon', to: 'Canning' },
  { label: 'Medici Bank → Modern banking', from: 'Medici Bank', to: 'Bank' },
  { label: 'Nikola Tesla → Coney Island', from: 'Nikola Tesla', to: 'Coney Island' },
  { label: 'Tulip mania → Financial bubble', from: 'Tulip mania', to: 'Economic bubble' },
  { label: 'Silk Road → Venice', from: 'Silk Road', to: 'Venice' },
  { label: 'Rosetta Stone → Champollion', from: 'Rosetta Stone', to: 'Jean-François Champollion' },
];
