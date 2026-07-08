import { useLatestTurn } from "../lib/metricsStore";

// Latency grading: green = healthy for a realtime voice loop, amber = felt,
// red = conversation-breaking. Thresholds are per-stage judgment calls, not
// provider SLAs — tune freely.
type Grade = [good: number, warn: number];

function gradeColor(v: number | undefined, [good, warn]: Grade): string {
  if (v == null) return "text-neutral-600";
  if (v <= good) return "text-emerald-300";
  if (v <= warn) return "text-amber-300";
  return "text-red-400";
}

interface Card {
  label: string;
  value?: number;
  unit: string;
  hint: string;
  grade?: Grade;
}

function fmtValue(c: Card): string {
  if (c.value == null) return "—";
  return c.unit === "tok/s" ? c.value.toFixed(1) : `${Math.round(c.value)}`;
}

// The headline numbers, live for the latest turn. All derive from the
// single MetricEvent stream emitted by the agent.
export default function MetricsCards() {
  const t = useLatestTurn();

  const cards: Card[] = [
    { label: "EOU delay", value: t?.endpointingMs, unit: "ms", hint: "speech end → turn commit", grade: [600, 1000] },
    { label: "STT final", value: t?.sttFinalMs, unit: "ms", hint: "speech → transcript", grade: [300, 600] },
    { label: "LLM TTFT", value: t?.llmTtftMs, unit: "ms", hint: "time to first token", grade: [600, 1200] },
    { label: "LLM speed", value: t?.llmTokPerSec, unit: "tok/s", hint: "output tokens / second" },
    { label: "TTS TTFB", value: t?.ttsFirstByteMs, unit: "ms", hint: "time to first audio", grade: [300, 600] },
    { label: "E2E", value: t?.e2eMs, unit: "ms", hint: "speech end → audio out", grade: [1000, 1600] },
  ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c, i) => (
        <div
          key={c.label}
          style={{ animationDelay: `${i * 45}ms` }}
          className="rise-in rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 flex flex-col gap-1 transition-colors hover:border-neutral-700"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {c.label}
          </span>
          <span
            className={`font-mono text-2xl font-medium tabular-nums ${
              c.grade ? gradeColor(c.value, c.grade) : "text-neutral-100"
            }`}
          >
            {fmtValue(c)}
            {c.value != null && (
              <span className="ml-1 text-xs font-normal text-neutral-500">{c.unit}</span>
            )}
          </span>
          <span className="text-[11px] text-neutral-500">{c.hint}</span>
        </div>
      ))}
    </section>
  );
}
