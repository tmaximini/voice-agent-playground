import type { TurnMetrics } from "@voice-playground/shared";

// One hue per pipeline stage, used everywhere a stage appears. Class names are
// spelled out in full so Tailwind's scanner picks them up.
export type StageKey = "eou" | "stt" | "llm" | "tts";

export const STAGES: Record<
  StageKey,
  { label: string; bg: string; text: string; tint: string }
> = {
  eou: { label: "Turn detection", bg: "bg-stage-eou", text: "text-stage-eou", tint: "bg-stage-eou/15" },
  stt: { label: "Transcript", bg: "bg-stage-stt", text: "text-stage-stt", tint: "bg-stage-stt/15" },
  llm: { label: "LLM", bg: "bg-stage-llm", text: "text-stage-llm", tint: "bg-stage-llm/15" },
  tts: { label: "Speech", bg: "bg-stage-tts", text: "text-stage-tts", tint: "bg-stage-tts/15" },
};

// End-to-end grading: what a caller feels. Judgment calls, tune freely.
export type Grade = "fast" | "ok" | "slow";

export function gradeE2e(ms?: number): Grade | undefined {
  if (ms == null) return undefined;
  if (ms <= 1000) return "fast";
  if (ms <= 1600) return "ok";
  return "slow";
}

export const GRADE: Record<Grade, { label: string; text: string; pill: string }> = {
  fast: { label: "Fast", text: "text-good", pill: "bg-good/10 border-good/40 text-good" },
  ok: { label: "Noticeable", text: "text-warn", pill: "bg-warn/10 border-warn/40 text-warn" },
  slow: { label: "Slow", text: "text-bad", pill: "bg-bad/10 border-bad/40 text-bad" },
};

export interface Lane {
  key: StageKey;
  /** ms after speech end */
  from: number;
  to: number;
}

/**
 * Lay a turn's stages out on one axis anchored at speech end. LLM and TTS run
 * to their FIRST token/byte — that's the part on the latency critical path.
 * Overlap is real: preemptive generation starts the LLM before the turn commits.
 */
export function lanes(t: TurnMetrics): { lanes: Lane[]; firstAudio?: number; span: number } {
  const s = t.stages;
  const anchor = s?.eou?.start;
  if (!s || anchor == null) return { lanes: [], span: 0 };
  const rel = (v: number) => Math.max(0, v - anchor);
  const out: Lane[] = [];
  const push = (key: StageKey, from?: number, to?: number) => {
    if (from != null && to != null) out.push({ key, from: rel(from), to: rel(to) });
  };
  push("eou", s.eou?.start, s.eou?.end);
  push("stt", s.stt?.start, s.stt?.end);
  push("llm", s.llm?.start, s.llm?.first);
  push("tts", s.tts?.start, s.tts?.first);
  const firstAudio = t.e2eMs ?? (s.tts?.first != null ? rel(s.tts.first) : undefined);
  const span = Math.max(firstAudio ?? 0, ...out.map((l) => l.to));
  return { lanes: out, firstAudio, span };
}

/** Round an axis span up to a readable step. */
export function niceAxis(span: number): { max: number; step: number } {
  const step = span <= 1200 ? 200 : span <= 2500 ? 500 : 1000;
  return { max: Math.max(step, Math.ceil((span * 1.08) / step) * step), step };
}
