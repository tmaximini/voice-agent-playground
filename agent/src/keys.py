"""Parse the SessionInit payload (config + BYOK keys) from the browser.

GUARDRAIL: BYOK keys are session-scoped. They are used ONLY to construct this
job's provider clients and are NEVER logged or persisted. The `keys` field is
excluded from the dataclass repr so an accidental log line cannot leak them.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

logger = logging.getLogger("voice-playground-agent")


@dataclass
class ProviderCfg:
    provider: str
    model: str
    options: dict


@dataclass
class TurnDetectionCfg:
    model: str = "multilingual"  # "multilingual" | "english"
    min_delay: float = 0.4
    max_delay: float = 3.0
    mode: str = "fixed"  # "fixed" | "dynamic"
    unlikely_threshold: float | None = None
    preemptive_tts: bool = True


@dataclass
class PipelineCfg:
    stt: ProviderCfg
    llm: ProviderCfg
    tts: ProviderCfg
    turn_detection: TurnDetectionCfg
    system_prompt: str | None


@dataclass
class SessionInit:
    config: PipelineCfg
    # repr=False so keys never appear in a stringified log line.
    keys: dict = field(repr=False)


def _provider_cfg(raw: dict) -> ProviderCfg:
    return ProviderCfg(
        provider=raw["provider"],
        model=raw["model"],
        options=raw.get("options") or {},
    )


def _turn_detection_cfg(raw: dict | None) -> TurnDetectionCfg:
    defaults = TurnDetectionCfg()
    raw = raw or {}
    return TurnDetectionCfg(
        model=raw.get("model") or defaults.model,
        min_delay=float(raw.get("minDelay", defaults.min_delay)),
        max_delay=float(raw.get("maxDelay", defaults.max_delay)),
        mode=raw.get("mode") or defaults.mode,
        unlikely_threshold=(
            float(raw["unlikelyThreshold"]) if raw.get("unlikelyThreshold") is not None else None
        ),
        preemptive_tts=bool(raw.get("preemptiveTts", defaults.preemptive_tts)),
    )


def parse_session_init(raw: bytes | str) -> SessionInit:
    data = json.loads(raw.decode() if isinstance(raw, (bytes, bytearray)) else raw)
    c = data["config"]
    config = PipelineCfg(
        stt=_provider_cfg(c["stt"]),
        llm=_provider_cfg(c["llm"]),
        tts=_provider_cfg(c["tts"]),
        turn_detection=_turn_detection_cfg(c.get("turnDetection")),
        system_prompt=c.get("systemPrompt"),
    )
    keys = data.get("keys") or {}

    # Log the (safe) config only — NEVER the keys.
    logger.info(
        "session init: stt=%s/%s llm=%s/%s tts=%s/%s turn=%s/%s %.2f-%.2fs (keys for: %s)",
        config.stt.provider,
        config.stt.model,
        config.llm.provider,
        config.llm.model,
        config.tts.provider,
        config.tts.model,
        config.turn_detection.model,
        config.turn_detection.mode,
        config.turn_detection.min_delay,
        config.turn_detection.max_delay,
        ",".join(sorted(keys.keys())),  # key NAMES only, never values
    )
    return SessionInit(config=config, keys=keys)
