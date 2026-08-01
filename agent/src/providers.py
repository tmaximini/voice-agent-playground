"""Provider factory / adapter discipline.

Maps a ProviderCfg + the caller's BYOK key to the correct LiveKit plugin
instance. This is the ONLY place provider clients are constructed. Adding a new
provider = one new branch here — nothing else in the agent changes.

These are the individual plugins (deepgram/openai/elevenlabs), which accept an
explicit api_key. That is what makes BYOK work; the inference gateway would use
LiveKit-hosted keys instead.
"""

from __future__ import annotations

from livekit.plugins import deepgram, elevenlabs, openai

from keys import ProviderCfg

# Route the OpenAI-compatible plugin at OpenRouter to unlock many LLMs at once.
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def build_stt(cfg: ProviderCfg, keys: dict):
    if cfg.provider == "deepgram":
        return deepgram.STT(
            model=cfg.model,
            language=cfg.options.get("language", "multi"),
            api_key=keys["deepgram"],
            # Finalize fast (plugin default): transcription_delay sits on the
            # end-of-utterance critical path, and the semantic turn detector —
            # not Deepgram's pause timer — owns the "is the user done" decision.
            # Multi-segment finals are fine; metrics.py accumulates them per turn.
            endpointing_ms=cfg.options.get("endpointingMs", 25),
            interim_results=True,
            punctuate=True,
            smart_format=True,
        )
    raise ValueError(f"unsupported STT provider: {cfg.provider}")


def build_llm(cfg: ProviderCfg, keys: dict):
    if cfg.provider == "openrouter":
        return openai.LLM(
            model=cfg.model,
            base_url=OPENROUTER_BASE_URL,
            api_key=keys["openrouter"],
            temperature=cfg.options.get("temperature"),
        )
    raise ValueError(f"unsupported LLM provider: {cfg.provider}")


def build_tts(cfg: ProviderCfg, keys: dict):
    if cfg.provider == "elevenlabs":
        kwargs = {}
        vs = cfg.options.get("voiceSettings") or {}
        if vs:
            # stability/similarity_boost are required by the dataclass; the
            # optional fields stay NOT_GIVEN unless the browser sent them.
            optional = {
                k: vs[src]
                for k, src in (("style", "style"), ("speed", "speed"))
                if vs.get(src) is not None
            }
            kwargs["voice_settings"] = elevenlabs.VoiceSettings(
                stability=float(vs.get("stability", 0.5)),
                similarity_boost=float(vs.get("similarityBoost", 0.75)),
                **optional,
            )
        return elevenlabs.TTS(
            model=cfg.model,
            voice_id=cfg.options.get("voiceId", "21m00Tcm4TlvDq8ikWAM"),
            api_key=keys["elevenlabs"],
            **kwargs,
        )
    raise ValueError(f"unsupported TTS provider: {cfg.provider}")
