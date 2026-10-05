"""Assemble a LiveKit AgentSession from the session's config + BYOK keys.

VAD -> STT -> LLM -> TTS with semantic turn detection. Streaming is left
overlapping (TTS can start before the LLM finishes) — do not serialize it, that
is core to realistic latency.
"""

from __future__ import annotations

import asyncio
import logging
import os

from livekit.agents import Agent, AgentSession, JobContext
from livekit.agents.voice.room_io import AudioInputOptions, RoomOptions
from livekit.plugins.turn_detector.english import EnglishModel
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from keys import SessionInit
from metrics import attach_metrics
from providers import build_llm, build_stt, build_tts

logger = logging.getLogger("voice-playground-agent")

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful, concise voice assistant. Keep replies short and natural "
    "for spoken conversation. Do not use emojis or markdown."
)


# Strong refs for fire-and-forget tasks (the loop only keeps weak ones).
_background: set[asyncio.Task] = set()


async def _warm_llm(llm) -> None:  # noqa: ANN001 - openai.LLM
    # openai.LLM.prewarm() is a no-op, so make a cheap request on
    # the plugin's own pooled client. Best-effort: failures only cost latency.
    try:
        await asyncio.wait_for(llm._client.models.list(), timeout=5.0)
    except Exception as err:  # noqa: BLE001
        logger.debug("LLM warm-up skipped: %s", type(err).__name__)


async def run_pipeline(ctx: JobContext, init: SessionInit, vad) -> None:
    config = init.config
    keys = init.keys  # used only to construct clients below; never logged

    td = config.turn_detection
    # The English model can't score other languages — only honor it for en.
    language = str(config.stt.options.get("language", "multi"))
    use_english = td.model == "english" and language.startswith("en")
    model_cls = EnglishModel if use_english else MultilingualModel
    turn_detector = model_cls(unlikely_threshold=td.unlikely_threshold)

    # The VAD is prewarmed once per process; set its silence per session so a
    # reused process never inherits the previous session's value.
    vad.update_options(min_silence_duration=td.vad_min_silence)

    llm = build_llm(config.llm, keys)
    # Open the TLS connection now (the client keeps it alive for 120s) so the
    # first user turn doesn't pay the handshake on its TTFT.
    warm = asyncio.create_task(_warm_llm(llm))
    _background.add(warm)
    warm.add_done_callback(_background.discard)

    session = AgentSession(
        vad=vad,
        stt=build_stt(config.stt, keys),
        llm=llm,
        tts=build_tts(config.tts, keys),
        turn_handling={
            # Must stay explicit: omitting turn_detection makes 1.6+ fall back
            # to LiveKit-hosted inference, which would bypass the BYOK/local
            # guarantee this project is built on.
            "turn_detection": turn_detector,
            # The semantic model gates the commit: a confident end-of-turn
            # waits only min_delay of silence; an unfinished-sounding utterance
            # gets up to max_delay to continue.
            "endpointing": {
                "mode": td.mode,
                "min_delay": td.min_delay,
                "max_delay": td.max_delay,
            },
            # LLM runs speculatively during the endpointing wait; preemptive
            # TTS overlaps synthesis too but bills retracted turns.
            "preemptive_generation": {
                "enabled": True,
                "preemptive_tts": td.preemptive_tts,
            },
        },
    )

    attach_metrics(
        session=session,
        room=ctx.room,
        loop=asyncio.get_running_loop(),
        stt_provider=config.stt.provider,
        llm_provider=config.llm.provider,
        tts_provider=config.tts.provider,
    )

    # Krisp BVC filters the agent's own voice (speaker echo) out of the mic
    # feed server-side — far stronger than browser AEC. Licensed for LiveKit
    # Cloud only, so gate on the URL: self-hosted/local keeps plain input.
    start_kwargs = {}
    if ".livekit.cloud" in os.environ.get("LIVEKIT_URL", ""):
        try:
            from livekit.plugins import noise_cancellation

            start_kwargs["room_options"] = RoomOptions(
                audio_input=AudioInputOptions(noise_cancellation=noise_cancellation.BVC())
            )
            logger.info("Krisp BVC noise cancellation enabled (LiveKit Cloud)")
        except ImportError:
            logger.warning("livekit-plugins-noise-cancellation not installed; BVC disabled")

    await session.start(
        agent=Agent(instructions=config.system_prompt or DEFAULT_SYSTEM_PROMPT),
        room=ctx.room,
        **start_kwargs,
    )

    # A fixed greeting so the user knows the agent is live. say() goes straight
    # to TTS — no LLM round-trip, so it plays immediately after join.
    await session.say("Hi, welcome to the playground. What can I do for you?")
