import type { PipelineConfig, TurnDetectionConfig, VoiceConfig } from "@voice-playground/shared";

// Static provider catalog. Phase 1 uses a single hardcoded pipeline; the shape
// is intentionally ready for Phase 2 dropdowns (STT/LLM/TTS provider+model+voice).
//
// GUARDRAIL: adding a provider is one new entry here (frontend) plus one new
// branch in agent/src/providers.py — nothing else changes.

export interface ProviderOption {
  provider: string;
  /** provider label shown in the UI */
  label: string;
  models: { id: string; label: string }[];
  /** which BYOK key this provider needs (keys are keyed by provider id) */
  keyId: string;
}

export const STT_PROVIDERS: ProviderOption[] = [
  {
    provider: "deepgram",
    label: "Deepgram",
    keyId: "deepgram",
    models: [{ id: "nova-3", label: "Nova-3" }],
  },
];

export const LLM_PROVIDERS: ProviderOption[] = [
  {
    provider: "openrouter",
    label: "OpenRouter",
    keyId: "openrouter",
    models: [
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
      { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
    ],
  },
];

export const TTS_PROVIDERS: ProviderOption[] = [
  {
    provider: "elevenlabs",
    label: "ElevenLabs",
    keyId: "elevenlabs",
    models: [{ id: "eleven_flash_v2_5", label: "Flash v2.5" }],
  },
];

/**
 * Curated ElevenLabs premade voices (IDs are stable, available on every
 * account). Any other voice from your ElevenLabs library works via the
 * custom-ID field in Settings.
 */
export const VOICES: { id: string; label: string; hint: string }[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", hint: "calm female" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", hint: "soft female" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", hint: "warm female" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", hint: "British female" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", hint: "deep male" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", hint: "deep male" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", hint: "warm British male" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", hint: "well-rounded male" },
];

/** ElevenLabs defaults: balanced delivery, normal rate. */
export const DEFAULT_VOICE: VoiceConfig = {
  voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1.0,
};

/** STT languages selectable in Settings ("multi" = Deepgram code-switching). */
export const LANGUAGES: { id: string; label: string }[] = [
  { id: "multi", label: "Multilingual (auto)" },
  { id: "en", label: "English" },
  { id: "de", label: "German" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
];

/**
 * Turn-detection defaults: semantic multilingual model, 0.4s min endpointing
 * (the model gates the commit, so a confident end-of-turn needs little
 * silence), preemptive TTS on for the lowest latency (costs TTS characters
 * when a turn is retracted).
 */
export const DEFAULT_TURN_DETECTION: Required<
  Pick<TurnDetectionConfig, "model" | "minDelay" | "maxDelay" | "mode" | "preemptiveTts">
> &
  TurnDetectionConfig = {
  model: "multilingual",
  minDelay: 0.4,
  maxDelay: 3.0,
  mode: "fixed",
  preemptiveTts: true,
};

/** The single hardcoded pipeline for Phase 1. */
export const DEFAULT_PIPELINE: PipelineConfig = {
  stt: { provider: "deepgram", model: "nova-3", options: { language: "multi" } },
  turnDetection: DEFAULT_TURN_DETECTION,
  llm: { provider: "openrouter", model: "openai/gpt-4o-mini", options: { temperature: 0.7 } },
  tts: {
    provider: "elevenlabs",
    model: "eleven_flash_v2_5",
    // Rachel — a default ElevenLabs voice. Swap voiceId for others.
    options: { voiceId: "21m00Tcm4TlvDq8ikWAM" },
  },
  systemPrompt:
    "You are a helpful, concise voice assistant. Keep replies short and natural for spoken conversation. Do not use emojis or markdown.",
};

/** BYOK keys required by the default pipeline, in display order. */
export const REQUIRED_KEYS: { id: string; label: string }[] = [
  { id: "deepgram", label: "Deepgram API key" },
  { id: "openrouter", label: "OpenRouter API key" },
  { id: "elevenlabs", label: "ElevenLabs API key" },
];
