import { useState } from "react";
import type { TurnMetrics } from "@voice-playground/shared";
import { sessionHistory, useSessions, type StoredSession } from "../lib/sessionHistory";
import { fmtUsd } from "../lib/cost";
import { GRADE, gradeE2e } from "../lib/stages";
import { fmtMs, ghostBtnCls, headingCls, panelCls } from "../lib/ui";
import { Line, TurnFooter } from "./TranscriptLog";

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
  return s.turns.find((t) => t.userText)?.userText ?? "Untitled session";
}

function avgE2e(turns: TurnMetrics[]): number | undefined {
  const vals = turns.map((t) => t.e2eMs).filter((v): v is number => v != null);
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function Detail({ s }: { s: StoredSession }) {
  return (
    <div className="space-y-4 border-t border-line px-3 pb-3 pt-4">
      {s.turns.map((t) => (
        <div key={t.turnId} className="space-y-1.5">
          {t.userText && <Line role="user">{t.userText}</Line>}
          {t.agentText && <Line role="agent">{t.agentText}</Line>}
          <TurnFooter turn={t} />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-faint">
        <span>
          {s.config.preset && <>{s.config.preset}, </>}
          {s.config.llmModel}, language {s.config.language}
        </span>
        <button
          onClick={() => sessionHistory.remove(s.id)}
          className={`${ghostBtnCls} hover:text-bad`}
        >
          Delete session
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
    <section className={panelCls}>
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
        <h2 className={headingCls}>Past sessions</h2>
        <button onClick={() => sessionHistory.clear()} className={`${ghostBtnCls} hover:text-bad`}>
          Clear all
        </button>
      </div>
      <ul className="space-y-1 p-2">
        {sessions.map((s) => {
          const open = openId === s.id;
          const avg = avgE2e(s.turns);
          const grade = gradeE2e(avg);
          return (
            <li
              key={s.id}
              className={`rounded-lg border transition-colors ${
                open ? "border-line bg-raised/50" : "border-transparent hover:bg-raised/60"
              }`}
            >
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                aria-expanded={open}
                className="grid w-full grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 px-3 py-3 text-left"
              >
                <span className="truncate text-sm">{title(s)}</span>
                <span className="text-xs tabular-nums text-faint">{fmtWhen(s.startedAt)}</span>
                <span className="flex flex-wrap gap-x-4 text-xs tabular-nums text-muted">
                  <span>{s.turns.length} {s.turns.length === 1 ? "turn" : "turns"}</span>
                  <span>{fmtDuration(s.durationMs)}</span>
                  {avg != null && (
                    <span>
                      avg <span className={grade ? GRADE[grade].text : ""}>{fmtMs(avg)} ms</span>
                    </span>
                  )}
                  <span>{fmtUsd(s.costUsd)}</span>
                </span>
              </button>
              {open && <Detail s={s} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
