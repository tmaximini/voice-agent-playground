import { useTurns } from "../lib/metricsStore";
import { useLiveLine } from "../lib/transcriptStore";

function fmtMs(v?: number): string {
  return v == null ? "—" : `${Math.round(v)}ms`;
}

function RoleChip({ role }: { role: "user" | "agent" }) {
  return (
    <span
      className={`inline-block w-14 shrink-0 font-mono text-[10px] font-medium uppercase tracking-widest ${
        role === "user" ? "text-neutral-500" : "text-emerald-500"
      }`}
    >
      {role === "user" ? "you" : "agent"}
    </span>
  );
}

// Scrollable per-turn transcript with the turn's key metrics inline, plus the
// in-flight utterance streamed live while the user (or agent) is mid-turn.
export default function TranscriptLog() {
  const turns = useTurns();
  const live = useLiveLine();

  if (turns.length === 0 && !live) {
    return (
      <section className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-10 text-center">
        <div aria-hidden className="mx-auto mb-3 flex w-fit items-end gap-1 opacity-40">
          {[8, 14, 20, 12, 6].map((h, i) => (
            <span key={i} className="w-1 rounded-full bg-neutral-500" style={{ height: h }} />
          ))}
        </div>
        <p className="text-sm text-neutral-500">Start a call and speak — turns appear here.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-neutral-900/60 border border-neutral-800 divide-y divide-neutral-800/70 max-h-[420px] overflow-y-auto">
      {live && (
        <div className="flex items-baseline gap-2 p-4 bg-emerald-500/[0.04]">
          <RoleChip role={live.role} />
          <p className="text-sm text-neutral-300">
            {live.text}
            <span className="caret-blink ml-0.5 text-emerald-400">▍</span>
          </p>
        </div>
      )}
      {turns.map((t) => (
        <div key={t.turnId} className="p-4 space-y-2">
          {t.userText && (
            <p className="flex items-baseline gap-2 text-sm">
              <RoleChip role="user" />
              <span className="text-neutral-200">{t.userText}</span>
            </p>
          )}
          {t.agentText && (
            <p className="flex items-baseline gap-2 text-sm">
              <RoleChip role="agent" />
              <span className="text-neutral-200">{t.agentText}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-16 font-mono text-[10px] tracking-wide text-neutral-500 tabular-nums">
            <span>eou {fmtMs(t.endpointingMs)}</span>
            <span>stt {fmtMs(t.sttFinalMs)}</span>
            <span>ttft {fmtMs(t.llmTtftMs)}</span>
            <span>tts {fmtMs(t.ttsFirstByteMs)}</span>
            <span className="text-neutral-400">e2e {fmtMs(t.e2eMs)}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
