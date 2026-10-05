// Pipeline configuration contract: browser (producer) -> agent (consumer).
//
// BYOK keys are deliberately kept OUT of PipelineConfig (see BYOKKeys below) so
// that config can be logged safely on the agent while keys are never logged or
// persisted. Keep this boundary — do not add a `key` field to ProviderConfig.

export type Stage = "stt" | "llm" | "tts";

export interface ProviderConfig {
  /** e.g. "deepgram", "openrouter", "elevenlabs" */
  provider: string;
  /** e.g. "nova-3", "openai/gpt-4o-mini", "eleven_flash_v2_5" */
  model: string;
  /** voice id, language, temperature, etc. */
  options?: Record<string, unknown>;
}

/**
 * Semantic turn-detection / endpointing knobs. All optional — the agent falls
 * back to its defaults (multilingual model, 0.4s/3.0s fixed endpointing,
 * preemptive TTS on). Exposed so the playground can benchmark how endpointing
 * choices move the latency numbers.
 */
export interface TurnDetectionConfig {
  /** semantic end-of-utterance model; pick "english" for English-only sessions */
  model?: "multilingual" | "english";
  /** min silence (s) before committing a turn the model considers finished */
  minDelay?: number;
  /** max wait (s) when the model considers the utterance unfinished */
  maxDelay?: number;
  /** "dynamic" adapts the delay to the speaker's pause rhythm (EMA) */
  mode?: "fixed" | "dynamic";
  /** EOU probability below this = "user not done"; omit for per-language default */
  unlikelyThreshold?: number;
  /** synthesize speech speculatively before the turn commits (costs TTS chars on retractions) */
  preemptiveTts?: boolean;
  /**
   * VAD end-of-speech silence (s). EOU detection starts only after this, so
   * it is the floor under minDelay. Lower = snappier, more mid-pause checks.
   */
  vadMinSilence?: number;
}

/**
 * TTS voice selection + delivery parameters (ElevenLabs semantics; ranges in
 * comments). Travels inside tts.options — kept as a named type so the
 * frontend preset store and the agent agree on the shape.
 */
export interface VoiceConfig {
  voiceId: string;
  /** 0–1: lower = more expressive/variable, higher = more monotone-consistent */
  stability?: number;
  /** 0–1: adherence to the original voice timbre */
  similarityBoost?: number;
  /** 0–1: style exaggeration; >0 costs extra latency */
  style?: number;
  /** 0.8–1.2: speaking rate */
  speed?: number;
}

export interface PipelineConfig {
  stt: ProviderConfig;
  llm: ProviderConfig;
  tts: ProviderConfig;
  turnDetection?: TurnDetectionConfig;
  systemPrompt?: string;
}

/**
 * provider -> apiKey. Read at job start, used to construct that job's provider
 * clients, and then discarded. NEVER logged, NEVER persisted.
 */
export interface BYOKKeys {
  [provider: string]: string;
}

/** Full payload sent into the room as the "session-init" data message. */
export interface SessionInit {
  config: PipelineConfig;
  keys: BYOKKeys;
}
