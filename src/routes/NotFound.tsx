import { A } from '@solidjs/router';
import { EmptyState } from '../components/bits';

export default function NotFound() {
  return (
    <div class="shell notfound">
      <EmptyState glyph="✦" title="Nothing down this hole">
        <p>
          That page wandered off. Head back to <A href="/">the start</A> or begin a{' '}
          <A href="/search">search</A>.
        </p>
      </EmptyState>
    </div>
  );
}
