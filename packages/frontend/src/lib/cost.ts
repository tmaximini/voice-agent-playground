import type { SessionUsage } from "./metricsStore";
import { LLM_PER_MTOK, STT_PER_MIN, TTS_PER_CHAR } from "../data/prices";

export interface CostBreakdown {
  stt: number;
  llm: number;
  tts: number;
  total: number;
}

export interface CostProviders {
  sttProvider: string;
  llmModel: string;
  ttsProvider: string;
}

/** Estimate session cost from accumulated usage + the price table. */
export function estimateCost(u: SessionUsage, p: CostProviders): CostBreakdown {
  const llmPrice = LLM_PER_MTOK[p.llmModel];
  const stt = (u.sessionMs / 60_000) * (STT_PER_MIN[p.sttProvider] ?? 0);
  const llm = llmPrice
    ? (u.llmTokensIn / 1e6) * llmPrice.in + (u.llmTokensOut / 1e6) * llmPrice.out
    : 0;
  const tts = u.ttsChars * (TTS_PER_CHAR[p.ttsProvider] ?? 0);
  return { stt, llm, tts, total: stt + llm + tts };
}

export function fmtUsd(v: number): string {
  return v < 0.01 && v > 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}
