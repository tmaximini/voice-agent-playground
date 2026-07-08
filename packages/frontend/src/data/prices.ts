// Rough pay-as-you-go price table for the cost estimate — EDIT ME if your
// plan differs (ElevenLabs especially is subscription-credit based, so the
// per-character figure varies a lot by tier). Prices as of mid-2026.

/** USD per minute of streamed audio, by STT provider. */
export const STT_PER_MIN: Record<string, number> = {
  deepgram: 0.0092, // nova-3 streaming, pay-as-you-go
};

/** USD per 1M tokens (in/out), by LLM model id. */
export const LLM_PER_MTOK: Record<string, { in: number; out: number }> = {
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "google/gemini-2.0-flash-001": { in: 0.1, out: 0.4 },
};

/** USD per character synthesized, by TTS provider. */
export const TTS_PER_CHAR: Record<string, number> = {
  elevenlabs: 0.00011, // flash v2.5 ≈ 0.5 credits/char on a Creator plan
};
