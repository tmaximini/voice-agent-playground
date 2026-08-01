import { useSyncExternalStore } from "react";
import type { TurnMetrics } from "@voice-playground/shared";
import type { SessionUsage } from "./metricsStore";
import { loadJSON, saveJSON } from "./persist";

// Past-session archive, persisted to localStorage. A session is saved once,
// when the call ends, from the metricsStore snapshot — the live stores stay
// the single source of truth while a call is running.

export interface StoredSession {
  id: string;
  /** epoch ms, browser clock */
  startedAt: number;
  durationMs: number;
  /** oldest-first, as spoken */
  turns: TurnMetrics[];
  usage: SessionUsage;
  /** cost snapshot at save time (price table may be edited later) */
  costUsd: number;
  config: {
    llmModel: string;
    sttProvider: string;
    ttsProvider: string;
    language: string;
    /** assistant preset name at save time */
    preset?: string;
  };
}

const KEY = "sessions";
// localStorage quota is ~5MB; sessions are a few KB each, 30 is comfortable.
const MAX_SESSIONS = 30;

type Listener = () => void;

class SessionHistoryStore {
  private sessions: StoredSession[] = loadJSON<StoredSession[]>(KEY, []);
  private listeners = new Set<Listener>();

  add(s: StoredSession): void {
    this.sessions = [s, ...this.sessions].slice(0, MAX_SESSIONS);
    this.persist();
  }

  remove(id: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    this.persist();
  }

  clear(): void {
    this.sessions = [];
    this.persist();
  }

  private persist(): void {
    saveJSON(KEY, this.sessions);
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): StoredSession[] => this.sessions;
}

export const sessionHistory = new SessionHistoryStore();

/** React hook: stored sessions, newest first. */
export function useSessions(): StoredSession[] {
  return useSyncExternalStore(sessionHistory.subscribe, sessionHistory.getSnapshot);
}
