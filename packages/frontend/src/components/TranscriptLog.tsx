import type { TurnMetrics } from "@voice-playground/shared";
import { useLiveLine } from "../lib/transcriptStore";
import { GRADE, gradeE2e } from "../lib/stages";
import { fmtMs, headingCls, panelCls } from "../lib/ui";
import { MiniTimeline } from "./LatencyTimeline";

interface Props {
  /** newest first */
  turns: TurnMetrics[];
  selectedId?: string;
  onSelect: (turnId: string) => void;
}

export function Line({ role, children }: { role: "user" | "agent"; children: React.ReactNode }) {
  return (
    <p className="grid grid-cols-[52px_1fr] gap-2 text-sm leading-relaxed">
      <span className="text-[13px] text-faint">{role === "user" ? "You" : "Agent"}</span>
      <span className={role === "user" ? "text-muted" : "text-fg"}>{children}</span>
    </p>
  );
}

export function TurnFooter({ turn }: { turn: TurnMetrics }) {
  const grade = gradeE2e(turn.e2eMs);
  return (
    <div className="ml-[60px] flex items-center gap-3">
      <MiniTimeline turn={turn} className="w-40" />
      {turn.e2eMs != null && (
        <span className={`text-xs font-medium tabular-nums ${grade ? GRADE[grade].text : ""}`}>
          {fmtMs(turn.e2eMs)} ms
        </span>
      )}
    </div>
  );
}

// The conversation so far, newest first, with each turn's timing signature.
// Selecting a turn opens its full breakdown in the turn panel above.
export default function TranscriptLog({ turns, selectedId, onSelect }: Props) {
  const live = useLiveLine();
  if (turns.length === 0 && !live) return null;

  return (
    <section className={panelCls}>
      <div className="flex items-baseline justify-between border-b border-line px-5 py-3.5">
        <h2 className={headingCls}>Conversation</h2>
        <span className="text-[13px] tabular-nums text-faint">
          {turns.length} {turns.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      <ol className="max-h-[460px] overflow-y-auto p-2">
        {live && (
          <li className="rounded-lg px-3 py-3">
            <Line role={live.role}>
              {live.text}
              <span className="caret-blink ml-0.5 text-fg">▍</span>
            </Line>
          </li>
        )}
        {turns.map((t) => {
          const selected = t.turnId === selectedId;
          return (
            <li key={t.turnId}>
              <button
                onClick={() => onSelect(t.turnId)}
                aria-pressed={selected}
                className={`block w-full space-y-1.5 rounded-lg border px-3 py-3 text-left transition-colors ${
                  selected
                    ? "border-line bg-raised"
                    : "border-transparent hover:bg-raised/60"
                }`}
              >
                {t.userText && <Line role="user">{t.userText}</Line>}
                {t.agentText && <Line role="agent">{t.agentText}</Line>}
                <div className="pt-1">
                  <TurnFooter turn={t} />
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
