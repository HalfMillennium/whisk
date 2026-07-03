import { For, Show, createMemo } from 'solid-js';
import type { PathStep } from '../lib/types';

interface Props {
  steps: PathStep[];
  activeIndex: number | null;
  onNodeClick: (i: number) => void;
}

const W = 1000;
const H = 200;

/* Deterministic jitter from the title, so the same trail always draws the same map. */
function jitter(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return (Math.abs(h) % 17) - 8; // -8..8
}

interface Pt {
  x: number;
  y: number;
  up: boolean;
}

function layout(steps: PathStep[]): Pt[] {
  const n = steps.length;
  return steps.map((s, i) => {
    const up = i % 2 === 0;
    return {
      x: Math.round(60 + (i * 880) / (n - 1)),
      y: Math.round(100 + (up ? -34 : 34) + jitter(s.page.title)),
      up,
    };
  });
}

/* Catmull-Rom through all points, emitted as cubic Béziers — the subway spine. */
function spinePath(pts: Pt[]): string {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function shortLabel(t: string): string {
  return t.length > 22 ? `${t.slice(0, 21).trimEnd()}…` : t;
}

/**
 * Decorative constellation view of a trail. The card list below it is the
 * canonical, accessible representation — this SVG is aria-hidden and offers
 * only a pointer shortcut (click a node → scroll to its card).
 */
export function TrailMap(props: Props) {
  const pts = createMemo(() => layout(props.steps));

  return (
    <Show when={props.steps.length >= 2}>
      <div class="trailmap" aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <path class="trailmap__track" d={spinePath(pts())} fill="none" stroke-width="5" />
          <path
            class="trailmap__spine"
            d={spinePath(pts())}
            fill="none"
            stroke-width="3"
            stroke-linecap="round"
            pathLength="1"
          />
          <For each={props.steps}>
            {(step, i) => {
              const pt = () => pts()[i()];
              const isEnd = () => i() === 0 || i() === props.steps.length - 1;
              const isActive = () => props.activeIndex === i();
              const anchor = () =>
                i() === 0 ? 'start' : i() === props.steps.length - 1 ? 'end' : 'middle';
              return (
                <g
                  class="trailmap__node"
                  classList={{
                    'trailmap__node--end': isEnd(),
                    'trailmap__node--active': isActive(),
                  }}
                  style={{ '--i': i() }}
                  onClick={() => props.onNodeClick(i())}
                >
                  <Show when={isEnd() || isActive()}>
                    <circle class="trailmap__halo" cx={pt().x} cy={pt().y} r="16" />
                  </Show>
                  <circle class="trailmap__circle" cx={pt().x} cy={pt().y} r="9" />
                  <text class="trailmap__num mono" x={pt().x} y={pt().y + 3.5} text-anchor="middle">
                    {i() + 1}
                  </text>
                  <text
                    class="trailmap__label"
                    x={pt().x}
                    y={pt().up ? pt().y - 22 : pt().y + 30}
                    text-anchor={anchor()}
                  >
                    {shortLabel(step.page.title)}
                  </text>
                </g>
              );
            }}
          </For>
        </svg>
      </div>
    </Show>
  );
}
