// Domain types for whisk.

export type ClusterType = 'people' | 'places' | 'events' | 'concepts' | 'other';

export const CLUSTER_ORDER: ClusterType[] = [
  'people',
  'events',
  'places',
  'concepts',
  'other',
];

export const CLUSTER_LABEL: Record<ClusterType, string> = {
  people: 'People',
  events: 'Events',
  places: 'Places',
  concepts: 'Concepts',
  other: 'Deep cuts',
};

/** A lightweight search hit before enrichment. */
export interface SearchHit {
  title: string;
  pageid: number;
  snippet: string; // HTML with <span class="searchmatch">
  wordcount: number;
  rank: number; // 0-based position in raw Wikipedia results
}

/** Interestingness breakdown — every signal is transparent. */
export interface Interestingness {
  score: number; // 0..100
  hiddenGem: number;
  unusualCategory: number;
  narrativeDensity: number;
  entitySpecificity: number;
  disputeSignal: number;
}

/** A fully enriched page ready to render as a result card / dossier. */
export interface Page {
  title: string;
  pageid: number;
  description?: string; // Wikidata short description
  extract?: string; // plain-text summary
  thumbnail?: string;
  url: string;
  lang: string;
  wikidataId?: string;
  cluster: ClusterType;
  instanceOf: string[]; // Wikidata P31 labels
  categories: string[]; // visible category names (no "Category:" prefix)
  coordinates?: { lat: number; lon: number };
  timePeriod?: string; // derived era / year label
  place?: string; // derived location label
  pageviews30d?: number;
  inboundLinks?: number;
  lastEdited?: string; // ISO timestamp
  protection?: string[]; // e.g. ["edit=autoconfirmed"]
  externalLinkCount?: number; // rough citation-density proxy
  disputed?: boolean;
  interestingness?: Interestingness;
  matchReason?: string; // "why this matched"
  keyEntities?: string[];
}

export interface SearchResult {
  query: string;
  expandedTerms: string[];
  clusters: Record<ClusterType, Page[]>;
  all: Page[];
  aiUsed: boolean;
}

export type PathMode =
  | 'shortest'
  | 'weirdest'
  | 'historical'
  | 'people'
  | 'places';

export interface PathStep {
  page: Page;
  jumpReason?: string; // why we hopped from the previous page to this one
}

export interface RabbitHole {
  from: string;
  to?: string; // undefined for open-ended walks
  mode: PathMode;
  steps: PathStep[];
  narration?: string; // AI or deterministic summary of the whole trail
  aiUsed: boolean;
  truncated?: boolean; // true if no full path found within budget
}

// ---- Collections (localStorage) ----
export interface CollectionItem {
  kind: 'page' | 'path';
  title: string; // page title, or "A → B" for a path
  description?: string;
  href: string; // in-app route
  note?: string;
  addedAt: number;
  payload?: unknown; // serialized RabbitHole for paths
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  items: CollectionItem[];
  createdAt: number;
  summary?: string; // auto-generated
}
