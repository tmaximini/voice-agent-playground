"""Stage instrumentation -> uniform MetricEvent stream -> browser data channel.

This is the heart of the project. Every stage is normalized into the SAME
MetricEvent shape, using ONE clock (this agent). The browser only visualizes
these events. Timestamps are epoch-ms.

Turn correlation: LLM / TTS / EOU metrics carry a shared `speech_id`, which we
use as the turnId. Streaming STT has no speech_id, so we derive the "STT final"
number from EOUMetrics.transcription_delay (end-of-speech -> final transcript)
and key it by the EOU speech_id.

Transcripts: STT finals are per-SEGMENT (one per short pause), so they are
accumulated until the turn commits at EOU. Every interim/final also streams to
the browser on the "transcript" topic so the UI can render live text.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time

from livekit import rtc
from livekit.agents import AgentSession, MetricsCollectedEvent
from livekit.agents.metrics import EOUMetrics, LLMMetrics, STTMetrics, TTSMetrics

logger = logging.getLogger("voice-playground-agent")

METRICS_TOPIC = "metrics"
TRANSCRIPT_TOPIC = "transcript"


def _now_ms() -> float:
    return time.time() * 1000.0


def attach_metrics(
    session: AgentSession,
    room: rtc.Room,
    loop: asyncio.AbstractEventLoop,
    stt_provider: str,
    llm_provider: str,
    tts_provider: str,
) -> None:
    # Per-turn scratch, keyed by speech_id: when the user stopped speaking,
    # the anchor for the wall-clock e2e number.
    speech_end_ms: dict[str, float] = {}

    # The in-progress user turn: committed STT finals + the latest interim.
    # Deepgram finalizes a SEGMENT at every short pause, so one utterance is
    # many finals — they must accumulate until the turn commits (EOU).
    user_segments: list[str] = []
    user_interim: dict[str, str] = {"v": ""}

    def _publish(event: dict, topic: str) -> None:
        # publish_data accepts a str payload (auto-encoded to UTF-8).
        loop.create_task(
            room.local_participant.publish_data(json.dumps(event), reliable=True, topic=topic)
        )

    def emit(event: dict) -> None:
        _publish(event, METRICS_TOPIC)

    def emit_transcript(role: str, text: str, final: bool, turn_id: str | None = None) -> None:
        event: dict = {"role": role, "text": text, "final": final, "ts": _now_ms()}
        if turn_id is not None:
            event["turnId"] = turn_id
        _publish(event, TRANSCRIPT_TOPIC)

    @session.on("user_input_transcribed")
    def _on_user_transcript(ev) -> None:  # noqa: ANN001 - SDK event type
        text = getattr(ev, "transcript", "") or ""
        if getattr(ev, "is_final", False):
            if text:
                user_segments.append(text)
            user_interim["v"] = ""
            live = " ".join(user_segments)
        else:
            user_interim["v"] = text
            live = " ".join([*user_segments, text] if text else user_segments)
        if live:
            emit_transcript("user", live, final=False)

    @session.on("speech_created")
    def _on_speech_created(ev) -> None:  # noqa: ANN001 - SDK event type
        # Agent text must be correlated by speech_id, not "latest assistant
        # message": LLM metrics for turn N fire before turn N-1's reply is
        # committed to chat, so a last-message shortcut attaches replies one
        # turn late. The speech handle owns its chat items and its id IS the
        # metrics speech_id.
        handle = ev.speech_handle

        def _flush(h) -> None:  # noqa: ANN001
            text = " ".join(
                (getattr(item, "text_content", "") or "")
                for item in h.chat_items
                if getattr(item, "role", None) == "assistant"
            ).strip()
            if text:
                emit_transcript("agent", text, final=True, turn_id=h.id)

        handle.add_done_callback(_flush)

    @session.on("metrics_collected")
    def _on_metrics(ev: MetricsCollectedEvent) -> None:
        m = ev.metrics
        now = _now_ms()

        if isinstance(m, EOUMetrics):
            turn = m.speech_id or "unknown"
            eou_ms = m.end_of_utterance_delay * 1000.0
            speech_end_ms[turn] = now - eou_ms
            transcription_ms = m.transcription_delay * 1000.0

            # The turn is committed: flush the accumulated segments (plus any
            # trailing interim that never finalized) as this turn's transcript.
            turn_text = " ".join(
                [*user_segments, user_interim["v"]] if user_interim["v"] else user_segments
            )
            user_segments.clear()
            user_interim["v"] = ""
            if turn_text:
                emit_transcript("user", turn_text, final=True, turn_id=turn)

            emit(
                {
                    "turnId": turn,
                    "stage": "stt",
                    "provider": stt_provider,
                    "tStart": now - transcription_ms,
                    "tFirst": now - transcription_ms,
                    "tEnd": now,
                    "meta": {"transcript": turn_text},
                }
            )
            # Where the endpointing time went: speech end -> turn commit.
            emit(
                {
                    "turnId": turn,
                    "stage": "eou",
                    "provider": "turn-detector",
                    "tStart": speech_end_ms[turn],
                    "tEnd": now,
                    "meta": {"transcriptionMs": transcription_ms},
                }
            )

        elif isinstance(m, LLMMetrics):
            turn = m.speech_id or "unknown"
            ttft_ms = m.ttft * 1000.0
            duration_ms = m.duration * 1000.0
            t_start = now - duration_ms
            emit(
                {
                    "turnId": turn,
                    "stage": "llm",
                    "provider": llm_provider,
                    "tStart": t_start,
                    "tFirst": t_start + ttft_ms,
                    "tEnd": now,
                    "meta": {
                        "tokensIn": m.prompt_tokens,
                        "tokensOut": m.completion_tokens,
                    },
                }
            )

        elif isinstance(m, TTSMetrics):
            turn = m.speech_id or "unknown"
            ttfb_ms = m.ttfb * 1000.0
            duration_ms = m.duration * 1000.0
            t_start = now - duration_ms
            emit(
                {
                    "turnId": turn,
                    "stage": "tts",
                    "provider": tts_provider,
                    "tStart": t_start,
                    "tFirst": t_start + ttfb_ms,
                    "tEnd": now,
                    "meta": {"chars": m.characters_count},
                }
            )
            # e2e = user speech end -> first audio byte, measured wall-clock
            # from the EOU anchor. Summing eou + ttft + ttfb would overstate it:
            # preemptive generation overlaps the LLM (and optionally TTS) with
            # the endpointing wait. No anchor means no user speech (say()
            # greetings) — e2e is meaningless there, skip it.
            t_first_audio = t_start + ttfb_ms
            e2e_ms = t_first_audio - speech_end_ms[turn] if turn in speech_end_ms else 0.0
            if e2e_ms > 0:
                emit(
                    {
                        "turnId": turn,
                        "stage": "e2e",
                        "provider": "pipeline",
                        "tStart": t_first_audio - e2e_ms,
                        "tEnd": t_first_audio,
                    }
                )
            # TTS closes the turn — drop its scratch so the map doesn't grow.
            speech_end_ms.pop(turn, None)

        elif isinstance(m, STTMetrics):
            # Streaming STT emits duration≈0 and no speech_id; the meaningful
            # "STT final" latency is derived from EOUMetrics above. Ignore here.
            return
