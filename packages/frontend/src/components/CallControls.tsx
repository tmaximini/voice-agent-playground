export type CallState = "idle" | "connecting" | "live" | "error";

interface Props {
  state: CallState;
  error?: string;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
}

const LABELS: Record<CallState, string> = {
  idle: "idle",
  connecting: "connecting…",
  live: "live",
  error: "error",
};

const DOT: Record<CallState, string> = {
  idle: "bg-neutral-500",
  connecting: "bg-amber-400 animate-pulse",
  live: "bg-emerald-400",
  error: "bg-red-500",
};

const TEXT: Record<CallState, string> = {
  idle: "text-neutral-400",
  connecting: "text-amber-300",
  live: "text-emerald-300",
  error: "text-red-400",
};

export default function CallControls({ state, error, canStart, onStart, onStop }: Props) {
  const live = state === "live" || state === "connecting";
  return (
    <section className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 text-sm">
        <span className="relative flex h-2.5 w-2.5">
          {state === "live" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT[state]}`} />
        </span>
        <span className={`font-mono text-xs uppercase tracking-widest ${TEXT[state]}`}>
          {LABELS[state]}
        </span>
        {error && <span className="text-red-400 text-xs">— {error}</span>}
      </div>

      {live ? (
        <button
          onClick={onStop}
          className="rounded-lg bg-red-500/10 border border-red-500/40 px-5 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 active:scale-[0.98]"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={!canStart}
          title={canStart ? undefined : "Enter your three API keys first"}
          className="rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-5 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start
        </button>
      )}
    </section>
  );
}
