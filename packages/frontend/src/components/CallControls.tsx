import { useEffect, useState } from "react";
import { dangerBtnCls, panelCls, primaryBtnCls } from "../lib/ui";

export type CallState = "idle" | "connecting" | "live" | "error";

interface Props {
  state: CallState;
  error?: string;
  canStart: boolean;
  assistantName: string;
  startedAt: number;
  onStart: () => void;
  onStop: () => void;
}

const DOT: Record<CallState, string> = {
  idle: "bg-faint",
  connecting: "bg-warn animate-pulse",
  live: "bg-good",
  error: "bg-bad",
};

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useElapsed(running: boolean, since: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return now - since;
}

export default function CallControls({
  state,
  error,
  canStart,
  assistantName,
  startedAt,
  onStart,
  onStop,
}: Props) {
  const active = state === "live" || state === "connecting";
  const elapsed = useElapsed(state === "live", startedAt);

  const status =
    state === "live"
      ? `On a call with ${assistantName}`
      : state === "connecting"
        ? "Connecting…"
        : state === "error"
          ? "Couldn't start the call"
          : canStart
            ? `Ready to call ${assistantName}`
            : "Add your three API keys to start a call";

  return (
    <section className={`${panelCls} flex items-center justify-between gap-4 px-5 py-4`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {state === "live" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-50" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT[state]}`} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{status}</p>
          {state === "error" && error && <p className="truncate text-[13px] text-bad">{error}</p>}
        </div>
        {state === "live" && (
          <span className="shrink-0 text-sm tabular-nums text-muted">{fmtElapsed(elapsed)}</span>
        )}
      </div>

      {active ? (
        <button onClick={onStop} className={`${dangerBtnCls} shrink-0 whitespace-nowrap`}>
          End call
        </button>
      ) : (
        <button onClick={onStart} disabled={!canStart} className={`${primaryBtnCls} shrink-0 whitespace-nowrap`}>
          <MicIcon />
          Start call
        </button>
      )}
    </section>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="5.5" y="1.75" width="5" height="8" rx="2.5" />
      <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" />
    </svg>
  );
}
