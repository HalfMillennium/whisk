// Wikidata typing: map pages to People / Places / Events / Concepts using the
// P31 ("instance of") claim, batched, with a keyword+known-Qid classifier.

import { cacheGet, cacheSet } from './cache';
import type { ClusterType } from '../types';

const WD_API = 'https://www.wikidata.org/w/api.php';

// High-confidence direct type Qids.
const PERSON_QIDS = new Set(['Q5']);
const PLACE_QIDS = new Set([
  'Q515', 'Q6256', 'Q3957', 'Q532', 'Q486972', 'Q82794', 'Q23442', 'Q8502',
  'Q4022', 'Q23397', 'Q22698', 'Q33837', 'Q1549591', 'Q515', 'Q3455524',
  'Q35657', 'Q5107', 'Q34876', 'Q133442', 'Q40080', 'Q839954',
]);
const EVENT_QIDS = new Set([
  'Q1656682', 'Q198', 'Q178561', 'Q3199915', 'Q1190554', 'Q13418847',
  'Q750215', 'Q10931', 'Q124490', 'Q180684', 'Q40231', 'Q3839081',
]);

const PLACE_WORDS = /\b(city|town|country|village|island|mountain|river|lake|region|state|province|building|settlement|place|county|municipality|territory|castle|temple|church|palace|park|kingdom|empire\b)/i;
const EVENT_WORDS = /\b(war|battle|event|revolution|disaster|epidemic|pandemic|election|treaty|uprising|siege|expedition|massacre|conflict|crisis|movement|incident|explosion|earthquake|famine|plague|rebellion)\b/i;

interface Batched {
  instanceOf: Record<string, string[]>; // Qid -> P31 label list
  cluster: Record<string, ClusterType>; // Qid -> classification
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function wdGet(params: Record<string, string>): Promise<any> {
  const usp = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const res = await fetch(`${WD_API}?${usp.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return res.json();
}

/**
 * For a set of Wikidata entity ids, return each one's P31 labels and a
 * People/Places/Events/Concepts classification.
 */
export async function typeEntities(ids: string[]): Promise<Batched> {
  const result: Batched = { instanceOf: {}, cluster: {} };
  const need = ids.filter(Boolean).filter((id, i, a) => a.indexOf(id) === i);
  const missing: string[] = [];
  for (const id of need) {
    const hit = cacheGet<{ labels: string[]; cluster: ClusterType }>(`wd:type:${id}`);
    if (hit) {
      result.instanceOf[id] = hit.labels;
      result.cluster[id] = hit.cluster;
    } else missing.push(id);
  }
  if (!missing.length) return result;

  // 1) fetch P31 target Qids for each entity
  const typeTargets: Record<string, string[]> = {};
  const allTypeQids = new Set<string>();
  for (const group of chunk(missing, 45)) {
    const data = await wdGet({
      action: 'wbgetentities',
      ids: group.join('|'),
      props: 'claims',
    });
    for (const id of group) {
      const claims = data?.entities?.[id]?.claims?.P31 ?? [];
      const targets: string[] = [];
      for (const c of claims) {
        const q = c?.mainsnak?.datavalue?.value?.id;
        if (q) {
          targets.push(q);
          allTypeQids.add(q);
        }
      }
      typeTargets[id] = targets;
    }
  }

  // 2) fetch labels for all referenced type Qids
  const typeLabels: Record<string, string> = {};
  for (const group of chunk([...allTypeQids], 45)) {
    if (!group.length) break;
    const data = await wdGet({
      action: 'wbgetentities',
      ids: group.join('|'),
      props: 'labels',
      languages: 'en',
    });
    for (const q of group) {
      typeLabels[q] = data?.entities?.[q]?.labels?.en?.value ?? '';
    }
  }

  for (const id of missing) {
    const targets = typeTargets[id] ?? [];
    const labels = targets.map((q) => typeLabels[q]).filter(Boolean);
    const cluster = classify(targets, labels);
    result.instanceOf[id] = labels;
    result.cluster[id] = cluster;
    cacheSet(`wd:type:${id}`, { labels, cluster }, 1000 * 60 * 60 * 24 * 7);
  }
  return result;
}

/** Priority: person > event > place > concept. */
export function classify(typeQids: string[], typeLabels: string[]): ClusterType {
  if (typeQids.some((q) => PERSON_QIDS.has(q))) return 'people';
  const labelText = typeLabels.join(' ');
  if (typeQids.some((q) => EVENT_QIDS.has(q)) || EVENT_WORDS.test(labelText))
    return 'events';
  if (typeQids.some((q) => PLACE_QIDS.has(q)) || PLACE_WORDS.test(labelText))
    return 'places';
  if (typeLabels.length) return 'concepts';
  return 'other';
}
