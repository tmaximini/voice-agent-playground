// Metric event contract: agent (producer) -> browser (consumer).
//
// Every provider adapter emits the SAME shape. This uniformity is what makes
// cross-provider comparison fair. All timestamps are epoch-ms taken on the
// agent worker (a single clock). Do not measure any stage differently.

export type MetricStage = "stt" | "llm" | "tts" | "eou" | "e2e";

export interface MetricEventMeta {
  tokensIn?: number;
  tokensOut?: number;
  /** characters synthesized — for TTS char-based pricing */
  chars?: number;
  /** STT final transcript (user); agent text arrives via TranscriptEvent */
  transcript?: string;
  /** end-of-speech → final transcript, inside the eou window (eou stage only) */
  transcriptionMs?: number;
}

export interface MetricEvent {
  /** groups all stages of one conversational turn */
  turnId: string;
  stage: MetricStage;
  provider: string;
  /** stage began (epoch ms, agent clock) */
  tStart: number;
  /** first partial (STT) / first token (LLM) / first audio byte (TTS) */
  tFirst?: number;
  /** stage completed (epoch ms, agent clock) */
  tEnd: number;
  meta?: MetricEventMeta;
}

/**
 * Derived per-turn view the dashboard assembles from MetricEvents. All the
 * headline numbers and cost derive from the single MetricEvent stream.
 */
export interface TurnMetrics {
  turnId: string;
  /** tEnd - tStart for stt */
  sttFinalMs?: number;
  /** tFirst - tStart for llm */
  llmTtftMs?: number;
  /** tokensOut / (tEnd - tFirst) for llm */
  llmTokPerSec?: number;
  /** tFirst - tStart for tts */
  ttsFirstByteMs?: number;
  /** user speech end -> first audio out */
  e2eMs?: number;
  /** speech end -> turn committed (endpointing wait, incl. transcription) */
  endpointingMs?: number;
  /** speech end -> final transcript, inside the endpointing window */
  transcriptionMs?: number;
  estCostUsd?: number;
  userText?: string;
  agentText?: string;
}

/**
 * Live transcript stream: agent (producer) -> browser (consumer). Emitted on
 * every STT interim/final so the UI can show text while the user speaks;
 * `final` marks the committed turn (EOU for user, conversation item for agent).
 */
export interface TranscriptEvent {
  role: "user" | "agent";
  /** full accumulated utterance text so far, not a delta */
  text: string;
  /** false = live interim, true = turn committed */
  final: boolean;
  /** MetricEvent.turnId — present on final user events */
  turnId?: string;
  /** epoch ms, agent clock */
  ts: number;
}

/** Data-channel topics used between browser and agent. */
export const SESSION_INIT_TOPIC = "session-init";
export const METRICS_TOPIC = "metrics";
export const TRANSCRIPT_TOPIC = "transcript";
