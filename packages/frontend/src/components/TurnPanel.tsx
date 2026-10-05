import type { TurnMetrics } from "@voice-playground/shared";
import { GRADE, STAGES, gradeE2e, type StageKey } from "../lib/stages";
import { fmtMs, ghostBtnCls, panelCls } from "../lib/ui";
import LatencyTimeline from "./LatencyTimeline";

interface Props {
  turn?: TurnMetrics;
  /** 1-based position, newest = total */
  index: number;
  total: number;
  onShowLatest?: () => void;
}

interface Stat {
  stage: StageKey;
  label: string;
  value?: number;
  unit: string;
  hint: string;
}

function stats(t?: TurnMetrics): Stat[] {
  return [
    { stage: "eou", label: "Turn detection", value: t?.endpointingMs, unit: "ms", hint: "Silence until the turn commits" },
    { stage: "stt", label: "Transcript", value: t?.sttFinalMs, unit: "ms", hint: "Speech end to final text" },
    { stage: "llm", label: "First token", value: t?.llmTtftMs, unit: "ms", hint: "LLM request to first token" },
    { stage: "llm", label: "Tokens/s", value: t?.llmTokPerSec, unit: "tok/s", hint: "LLM output speed" },
    { stage: "tts", label: "First byte", value: t?.ttsFirstByteMs, unit: "ms", hint: "TTS text to first audio" },
  ];
}

// The headline view: one turn's end-to-end number, the waterfall that explains
// it, and the per-stage numbers as a legend. Shows the newest turn unless the
// user picked an older one in the conversation.
export default function TurnPanel({ turn, index, total, onShowLatest }: Props) {
  const grade = gradeE2e(turn?.e2eMs);
  const isLatest = index === total;

  return (
    <section className={`${panelCls} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 pt-5">
        <div>
          <h2 className="text-[13px] text-muted">
            {total === 0 ? "Response time" : isLatest ? "Latest turn" : `Turn ${index} of ${total}`}
          </h2>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-5xl font-semibold tracking-tight tabular-nums ${
                turn?.e2eMs == null ? "text-faint" : "text-fg"
              }`}
            >
              {fmtMs(turn?.e2eMs)}
            </span>
            {turn?.e2eMs != null && <span className="text-base text-muted">ms</span>}
            {grade && (
              <span
                className={`ml-1 self-center rounded-full border px-2 py-0.5 text-xs font-medium ${GRADE[grade].pill}`}
              >
                {GRADE[grade].label}
              </span>
            )}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            From when you stop talking to the agent's first audio.
          </p>
        </div>
        {!isLatest && onShowLatest && (
          <button onClick={onShowLatest} className={ghostBtnCls}>
            Show latest turn
          </button>
        )}
      </div>

      <div className="px-5 pb-5 pt-9">
        {turn ? (
          <LatencyTimeline turn={turn} />
        ) : (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Start a call and say something. Each turn's timing breaks down here.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 border-t border-line bg-canvas/40">
        {stats(turn).map((s) => (
          <div key={s.label} className="px-5 py-3.5">
            <dt className="flex items-center gap-2 whitespace-nowrap text-[13px] text-muted">
              <span aria-hidden className={`h-2 w-2 rounded-sm ${STAGES[s.stage].bg}`} />
              {s.label}
            </dt>
            <dd className="mt-1 text-xl font-medium tabular-nums">
              {s.value == null ? (
                <span className="text-faint">—</span>
              ) : (
                <>
                  {s.unit === "tok/s" ? s.value.toFixed(1) : fmtMs(s.value)}
                  <span className="ml-1 text-xs font-normal text-muted">{s.unit}</span>
                </>
              )}
            </dd>
            <p className="mt-0.5 text-xs text-faint">{s.hint}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
