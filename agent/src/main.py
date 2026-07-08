"""AgentServer entrypoint. Registers OUTBOUND to LiveKit and waits for jobs.

Reads env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
Provider (BYOK) keys are NOT env vars — they arrive per-session from the browser
over the "session-init" data topic.

Run locally:  python src/main.py dev
Download the turn-detector model once:  python src/main.py download-files
"""

from __future__ import annotations

import asyncio
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, JobProcess, WorkerOptions, cli
from livekit.plugins import silero

from keys import parse_session_init
from pipeline import run_pipeline

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-playground-agent")

SESSION_INIT_TOPIC = "session-init"
SESSION_INIT_TIMEOUT_S = 30.0


def prewarm(proc: JobProcess) -> None:
    # Load Silero VAD once per worker process, not per job.
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    # Attach the data handler BEFORE connecting so there is no window in which
    # the browser's session-init message could be missed. The browser resends
    # this once it sees the agent join (data messages aren't buffered for late
    # joiners), so the two sides rendezvous reliably.
    fut: asyncio.Future[bytes] = asyncio.get_running_loop().create_future()

    def on_data(packet: rtc.DataPacket) -> None:
        if packet.topic == SESSION_INIT_TOPIC and not fut.done():
            fut.set_result(bytes(packet.data))

    ctx.room.on("data_received", on_data)

    await ctx.connect()
    logger.info("agent joined room=%s, waiting for session init", ctx.room.name)

    try:
        raw = await asyncio.wait_for(fut, timeout=SESSION_INIT_TIMEOUT_S)
    finally:
        ctx.room.off("data_received", on_data)

    init = parse_session_init(raw)
    await run_pipeline(ctx, init, ctx.proc.userdata["vad"])


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
