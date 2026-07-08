# Agent worker

Python LiveKit Agents worker. This is where **all** provider calls happen and
where **all** latency is measured. It registers outbound to LiveKit and waits for
jobs; there are no inbound ports.

## Local dev

```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# one-time: fetch turn-detector + VAD model weights
python src/main.py download-files

# set LiveKit creds (NOT provider keys — those are per-session BYOK)
export LIVEKIT_URL=wss://<your-project>.livekit.cloud
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
# or put them in agent/.env

python src/main.py dev
```

You should see the worker register (`registered worker ...`). The BYOK provider
keys arrive per session from the browser over the `session-init` data topic —
they are never read from the environment, never logged, never persisted.

## Docker (VM)

```bash
docker build -t voice-playground-agent .
docker run --rm \
  -e LIVEKIT_URL=wss://<your-project>.livekit.cloud \
  -e LIVEKIT_API_KEY=... \
  -e LIVEKIT_API_SECRET=... \
  voice-playground-agent
```

Recommended VM: 2 vCPU / 4 GB for solo/dev; ~4 vCPU / 8 GB per agent server for
10–25 concurrent calls. CPU-only (all AI inference is at the provider endpoints).
Place the VM near your LiveKit region for realistic latency numbers.

## Layout

| file | role |
|------|------|
| `src/main.py` | worker registration, prewarm (Silero VAD), await `session-init` |
| `src/keys.py` | parse `SessionInit`; scope BYOK keys; never log them |
| `src/providers.py` | factory: `{provider, model, options}` + key → LiveKit plugin |
| `src/pipeline.py` | assemble `AgentSession` (VAD→STT→LLM→TTS + turn detection) |
| `src/metrics.py` | normalize stage timings → `MetricEvent` → browser data channel |

## SDK note

Built against `livekit-agents` 1.x using the `WorkerOptions` / `entrypoint_fnc`
surface and the individual provider plugins (which accept `api_key=` — required
for BYOK). If your installed version differs, the pieces most likely to need a
tweak are the worker bootstrap in `main.py` and the plugin constructor kwargs in
`providers.py`. The `MetricEvent` schema and data-channel contract are stable.
