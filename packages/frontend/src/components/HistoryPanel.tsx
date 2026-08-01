import { useState } from "react";
import type { TurnMetrics } from "@voice-playground/shared";
import { sessionHistory, useSessions, type StoredSession } from "../lib/sessionHistory";
import { fmtUsd } from "../lib/cost";

function fmtWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function title(s: StoredSession): string {
  const first = s.turns.find((t) => t.userText)?.userText;
  return first ? (first.length > 64 ? `${first.slice(0, 64)}…` : first) : "Session";
}

function avgE2e(turns: TurnMetrics[]): number | undefined {
  const vals = turns.map((t) => t.e2eMs).filter((v): v is number => v != null);
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function Transcript({ s }: { s: StoredSession }) {
  return (
    <div className="space-y-3 border-t border-neutral-800/70 pt-3">
      {s.turns.map((t) => (
        <div key={t.turnId} className="space-y-1">
          {t.userText && (
            <p className="flex items-baseline gap-2 text-sm">
              <span className="inline-block w-14 shrink-0 font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                you
              </span>
              <span className="text-neutral-300">{t.userText}</span>
            </p>
          )}
          {t.agentText && (
            <p className="flex items-baseline gap-2 text-sm">
              <span className="inline-block w-14 shrink-0 font-mono text-[10px] font-medium uppercase tracking-widest text-emerald-500">
                agent
              </span>
              <span className="text-neutral-300">{t.agentText}</span>
            </p>
          )}
          {t.e2eMs != null && (
            <p className="pl-16 font-mono text-[10px] tracking-wide text-neutral-600 tabular-nums">
              e2e {Math.round(t.e2eMs)}ms
            </p>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
          {s.config.preset ? `${s.config.preset} · ` : ""}
          {s.config.llmModel} · {s.config.sttProvider} · {s.config.ttsProvider} · lang{" "}
          {s.config.language}
        </span>
        <button
          onClick={() => sessionHistory.remove(s.id)}
          className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-red-400 transition-colors"
        >
          delete
        </button>
      </div>
    </div>
  );
}

// Past sessions, newest first. Click a row to expand its full transcript.
// Saved to localStorage on call end — see finishSession in App.tsx.
export default function HistoryPanel() {
  const sessions = useSessions();
  const [openId, setOpenId] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  return (
    <section className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          Past sessions
        </h2>
        <button
          onClick={() => sessionHistory.clear()}
          className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-red-400 transition-colors"
        >
          clear all
        </button>
      </div>
      <div className="space-y-2">
        {sessions.map((s) => {
          const open = openId === s.id;
          const avg = avgE2e(s.turns);
          return (
            <div
              key={s.id}
              className={`rounded-lg border p-3 space-y-3 transition-colors ${
                open
                  ? "bg-emerald-500/[0.04] border-emerald-500/20"
                  : "bg-neutral-900/40 border-neutral-800/70 hover:border-neutral-700"
              }`}
            >
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                className="block w-full text-left space-y-1"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-neutral-200">{title(s)}</span>
                  <span className="shrink-0 font-mono text-[10px] text-neutral-500 tabular-nums">
                    {fmtWhen(s.startedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 font-mono text-[10px] tracking-wide text-neutral-500 tabular-nums">
                  <span>{fmtDuration(s.durationMs)}</span>
                  <span>{s.turns.length} turns</span>
                  {avg != null && <span>avg e2e {Math.round(avg)}ms</span>}
                  <span>{fmtUsd(s.costUsd)}</span>
                </div>
              </button>
              {open && <Transcript s={s} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
