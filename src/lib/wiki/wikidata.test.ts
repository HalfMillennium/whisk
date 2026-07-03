import { describe, it, expect } from 'vitest';
import { classify } from './wikidata';

describe('classify (Wikidata P31 -> cluster)', () => {
  it('classifies humans as people', () => {
    expect(classify(['Q5'], ['human'])).toBe('people');
  });

  it('classifies wars/battles as events by known Qid or keyword', () => {
    expect(classify(['Q198'], ['war'])).toBe('events');
    expect(classify(['Q99999'], ['military conflict'])).toBe('events');
  });

  it('classifies cities/countries as places', () => {
    expect(classify(['Q515'], ['city'])).toBe('places');
    expect(classify(['Q12345'], ['island nation'])).toBe('places');
  });

  it('falls back to concepts when typed but not person/place/event', () => {
    expect(classify(['Q11446'], ['ship'])).toBe('concepts');
  });

  it('returns other when nothing is known', () => {
    expect(classify([], [])).toBe('other');
  });

  it('prioritises person over place when both present', () => {
    expect(classify(['Q5', 'Q515'], ['human', 'city'])).toBe('people');
  });
});
