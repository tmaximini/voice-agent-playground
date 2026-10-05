import type { TurnMetrics } from "@voice-playground/shared";
import { STAGES, lanes, niceAxis } from "../lib/stages";
import { fmtMs } from "../lib/ui";

const pct = (v: number, max: number) => `${(v / max) * 100}%`;

/**
 * Per-turn waterfall on one axis anchored at the moment the user stopped
 * talking. Bars that overlap are the point: preemptive generation runs the LLM
 * inside the turn-detection wait, which is why first audio lands sooner than
 * the stage latencies add up to.
 */
export default function LatencyTimeline({ turn }: { turn: TurnMetrics }) {
  const { lanes: rows, firstAudio, span } = lanes(turn);
  if (rows.length === 0) return null;
  const { max, step } = niceAxis(span);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);

  return (
    <figure
      key={turn.turnId}
      className="grid grid-cols-[96px_1fr] gap-x-3 pr-10 sm:grid-cols-[120px_1fr]"
      aria-label="Stage timeline for this turn"
    >
      {rows.map((l, i) => {
        const st = STAGES[l.key];
        return (
          <div key={l.key} className="contents">
            <span
              className="col-start-1 flex h-8 items-center text-[13px] text-muted"
              style={{ gridRow: i + 1 }}
            >
              {st.label}
            </span>
            <div className="relative z-10 col-start-2 h-8" style={{ gridRow: i + 1 }}>
              <div
                className={`bar-grow absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${st.bg}`}
                style={{
                  left: pct(l.from, max),
                  width: `max(6px, ${pct(l.to - l.from, max)})`,
                  animationDelay: `${i * 60}ms`,
                }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 pl-2 text-xs tabular-nums text-muted"
                style={{ left: pct(l.to, max) }}
              >
                {fmtMs(l.to - l.from)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Gridlines behind every lane */}
      <div
        aria-hidden
        className="pointer-events-none relative col-start-2 row-start-1"
        style={{ gridRowEnd: `span ${rows.length}` }}
      >
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute inset-y-0 border-l border-dashed border-line"
            style={{ left: pct(t, max) }}
          />
        ))}
      </div>

      {/* Axis + first-audio marker */}
      <div
        className="relative col-start-2 mt-1 h-5 text-[11px] tabular-nums text-faint"
        style={{ gridRow: rows.length + 1 }}
      >
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 first:translate-x-0"
            style={{ left: pct(t, max) }}
          >
            {t === 0 ? "0" : `${t / 1000}s`}
          </span>
        ))}
      </div>
      {firstAudio != null && (
        <div
          aria-hidden
          className="pointer-events-none relative z-20 col-start-2 row-start-1"
          style={{ gridRowEnd: `span ${rows.length}` }}
        >
          <span
            className="absolute -top-1 bottom-0 w-px bg-fg/70"
            style={{ left: pct(firstAudio, max) }}
          />
          <span
            className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-canvas"
            style={{ left: pct(firstAudio, max) }}
          >
            First audio
          </span>
        </div>
      )}
    </figure>
  );
}

/** Compact four-line signature of a turn, for transcript and history rows. */
export function MiniTimeline({ turn, className = "" }: { turn: TurnMetrics; className?: string }) {
  const { lanes: rows, firstAudio, span } = lanes(turn);
  if (rows.length === 0) return null;
  const max = span * 1.04;
  return (
    <div aria-hidden className={`relative flex h-[19px] flex-col justify-between ${className}`}>
      {rows.map((l) => (
        <div key={l.key} className="relative h-[3px] rounded-full bg-raised">
          <div
            className={`absolute inset-y-0 rounded-full ${STAGES[l.key].bg}`}
            style={{ left: pct(l.from, max), width: `max(3px, ${pct(l.to - l.from, max)})` }}
          />
        </div>
      ))}
      {firstAudio != null && (
        <span
          className="absolute -inset-y-0.5 w-px bg-fg/60"
          style={{ left: pct(firstAudio, max) }}
        />
      )}
    </div>
  );
}
