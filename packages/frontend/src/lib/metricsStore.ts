import { useSyncExternalStore } from "react";
import type { MetricEvent, TurnMetrics } from "@voice-playground/shared";

// Dependency-free in-memory store. Consumes raw MetricEvents from the agent and
// folds them into per-turn TurnMetrics keyed by turnId. The frontend only ever
// VISUALIZES; the agent is the single source of truth for all timing.

type Listener = () => void;

/** Session-accumulated usage, folded from the same MetricEvent stream. */
export interface SessionUsage {
  llmTokensIn: number;
  llmTokensOut: number;
  ttsChars: number;
  /** streamed-audio time ≈ first event → last event (the mic streams continuously) */
  sessionMs: number;
}

const EMPTY_USAGE: SessionUsage = { llmTokensIn: 0, llmTokensOut: 0, ttsChars: 0, sessionMs: 0 };

class MetricsStore {
  private turns = new Map<string, TurnMetrics>();
  private order: string[] = [];
  private snapshot: TurnMetrics[] = [];
  private listeners = new Set<Listener>();
  private usage: SessionUsage = { ...EMPTY_USAGE };
  private firstEventMs?: number;

  private get(turnId: string): TurnMetrics {
    let t = this.turns.get(turnId);
    if (!t) {
      t = { turnId };
      this.turns.set(turnId, t);
      this.order.push(turnId);
    }
    return t;
  }

  ingest(ev: MetricEvent): void {
    this.firstEventMs ??= ev.tStart;
    this.usage.sessionMs = Math.max(this.usage.sessionMs, ev.tEnd - this.firstEventMs);
    if (ev.stage === "llm") {
      this.usage.llmTokensIn += ev.meta?.tokensIn ?? 0;
      this.usage.llmTokensOut += ev.meta?.tokensOut ?? 0;
    } else if (ev.stage === "tts") {
      this.usage.ttsChars += ev.meta?.chars ?? 0;
    }

    const t = this.get(ev.turnId);
    if (ev.stage !== "e2e") {
      t.stages = {
        ...t.stages,
        [ev.stage]: { start: ev.tStart, first: ev.tFirst, end: ev.tEnd },
      };
    }
    switch (ev.stage) {
      case "stt":
        t.sttFinalMs = ev.tEnd - ev.tStart;
        if (ev.meta?.transcript) t.userText = ev.meta.transcript;
        break;
      case "llm":
        if (ev.tFirst != null) t.llmTtftMs = ev.tFirst - ev.tStart;
        if (ev.tFirst != null && ev.meta?.tokensOut && ev.tEnd > ev.tFirst) {
          t.llmTokPerSec = (ev.meta.tokensOut / (ev.tEnd - ev.tFirst)) * 1000;
        }
        break;
      case "tts":
        if (ev.tFirst != null) t.ttsFirstByteMs = ev.tFirst - ev.tStart;
        break;
      case "eou":
        t.endpointingMs = ev.tEnd - ev.tStart;
        t.transcriptionMs = ev.meta?.transcriptionMs;
        break;
      case "e2e":
        t.e2eMs = ev.tEnd - ev.tStart;
        // estCostUsd is derived in the CostPanel (Phase 2) from a price table.
        break;
    }
    this.emit();
  }

  /** Attach finalized transcript text to its turn (from TranscriptEvents). */
  setTurnText(turnId: string, role: "user" | "agent", text: string): void {
    const t = this.get(turnId);
    if (role === "user") t.userText = text;
    else t.agentText = text;
    this.emit();
  }

  reset(): void {
    this.turns.clear();
    this.order = [];
    this.usage = { ...EMPTY_USAGE };
    this.firstEventMs = undefined;
    this.emit();
  }

  private usageSnapshot: SessionUsage = { ...EMPTY_USAGE };

  private emit(): void {
    // newest first for the dashboard
    this.snapshot = this.order.map((id) => ({ ...this.turns.get(id)! })).reverse();
    this.usageSnapshot = { ...this.usage };
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): TurnMetrics[] => this.snapshot;
  getUsage = (): SessionUsage => this.usageSnapshot;
}

export const metricsStore = new MetricsStore();

/** React hook: newest-first list of per-turn metrics. */
export function useTurns(): TurnMetrics[] {
  return useSyncExternalStore(metricsStore.subscribe, metricsStore.getSnapshot);
}

/** React hook: the latest turn (for the headline cards), or undefined. */
export function useLatestTurn(): TurnMetrics | undefined {
  return useTurns()[0];
}

/** React hook: session-accumulated token/char/time usage. */
export function useSessionUsage(): SessionUsage {
  return useSyncExternalStore(metricsStore.subscribe, metricsStore.getUsage);
}
