import { useSyncExternalStore } from "react";
import type { TranscriptEvent } from "@voice-playground/shared";

// Live transcript line, streamed from the agent while a turn is in progress.
// Finalized turns live in metricsStore (userText/agentText per turn); this
// store only holds the in-flight text so the UI can show words as they're
// spoken. Same dependency-free pattern as metricsStore.

type Listener = () => void;

export interface LiveLine {
  role: "user" | "agent";
  text: string;
}

class TranscriptStore {
  private live: LiveLine | null = null;
  private listeners = new Set<Listener>();

  ingest(ev: TranscriptEvent): void {
    // A final event closes the live line — the committed text arrives in the
    // turn's MetricEvents and renders in the per-turn history instead.
    this.live = ev.final ? null : { role: ev.role, text: ev.text };
    for (const l of this.listeners) l();
  }

  reset(): void {
    this.live = null;
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): LiveLine | null => this.live;
}

export const transcriptStore = new TranscriptStore();

/** React hook: the in-flight utterance (user speaking / agent replying), or null. */
export function useLiveLine(): LiveLine | null {
  return useSyncExternalStore(transcriptStore.subscribe, transcriptStore.getSnapshot);
}
