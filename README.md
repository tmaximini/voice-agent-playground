# AI Voice Playground

A browser-only, open-source playground for building and benchmarking realtime
voice-agent pipelines. Bring your own API keys (BYOK), and hold a spoken
conversation while a live dashboard breaks down the **latency of every turn** —
end-of-utterance (turn detection) delay, STT final, LLM time-to-first-token,
LLM tokens/sec, TTS first-byte, and wall-clock end-to-end — plus a **live
transcript** that streams word-by-word as you speak.

The value is the **measurement layer**, not the agent. The pipeline is commodity;
the instrumented dashboard is the point.

## Features

- **Per-turn latency dashboard** — six headline numbers per turn, measured on a
  single clock (the agent). End-to-end is wall-clock from your speech end to
  the first audio byte, so overlapped stages aren't double-counted.
- **Semantic turn detection, fully tunable** — LiveKit's end-of-utterance model
  (multilingual or English) decides whether you *sound* finished; Settings
  exposes the endpointing mode (fixed/dynamic), min/max delay, and the model's
  confidence threshold so you can benchmark how each knob moves the numbers.
- **Preemptive generation** — the LLM (and optionally TTS) runs speculatively
  during the endpointing wait, so the reply starts sooner than the sum of the
  stage latencies.
- **Live transcripts** — interim STT results stream to the browser over a data
  channel; finalized turns accumulate every Deepgram segment, not just the last.
- **Assistant presets** — save named bundles of system prompt + language +
  turn-detection profile, and switch/duplicate them to A/B different configs
  against the same dashboard. Stored locally; keys are never part of a preset.
- **Session history & cost estimates** — finished calls are archived to
  localStorage with full transcript, per-turn latency, accumulated token/char
  usage, and a rough cost estimate (price table is editable in
  `packages/frontend/src/data/prices.ts`).
- **BYOK, keys never touch a server** — provider keys go browser → room → agent,
  are used for that session only, and are never logged or persisted.

## Architecture

The browser talks to only two things: the **Cloudflare Worker** (to fetch a
LiveKit token) and the **LiveKit room** (WebRTC media + a data channel). It
**never** calls a provider directly. All provider calls originate in the Python
**agent worker**, which reads the user's BYOK keys per-session and uses them for
that session's outbound calls only.

```
Browser (SPA) ──token──▶ Cloudflare Worker  (signs LiveKit JWT)
      │
      └──WebRTC media + data──▶ LiveKit Cloud ──▶ Agent worker (VM)
                                                   VAD → STT → semantic turn
                                                   detection → LLM → TTS
                                                   emits MetricEvents +
                                                   TranscriptEvents back
                                                   Deepgram · OpenRouter · ElevenLabs
```

BYOK keys travel as data: browser → room → agent. They are used at job start,
**never logged, never persisted**, and discarded when the session ends.

## Turn detection & latency tuning

Deciding *when you're done talking* is where most voice-agent latency hides.
This playground runs LiveKit's semantic end-of-utterance (EOU) model on top of
Silero VAD, and makes every knob a Settings field:

| Knob | Default | What it does |
|------|---------|--------------|
| Language (STT) | `multi` | Deepgram language; picking `en` also selects the faster English EOU model |
| EOU model | `multilingual` | `english` is smaller/faster; `multilingual` handles code-switching |
| Endpointing | `fixed` | `dynamic` adapts the wait to the speaker's pause rhythm |
| Min delay | `0.4s` | Silence needed to commit a turn the model considers finished |
| Max delay | `3.0s` | Cap on the wait when the model thinks you're mid-sentence |
| Unlikely threshold | per-language | Below this end-of-turn probability the agent keeps waiting |
| Preemptive TTS | on | Synthesize speculatively during the endpointing wait (retracted turns still bill TTS characters) |

How a turn commits: VAD detects silence → Deepgram finalizes the transcript
fast (`endpointing_ms=25`) → the EOU model scores whether the utterance *sounds*
complete → confident turns commit after **min delay** of silence, doubtful ones
get up to **max delay** to continue. The LLM starts speculatively before the
commit (preemptive generation), so the measured end-to-end is typically well
below the sum of the stage latencies.

The **EOU delay** card shows exactly what this decision cost each turn — try a
deliberate mid-sentence pause ("What's the weather … in Berlin tomorrow?") and
watch it hold, then compare `fixed` vs `dynamic` endpointing on your own
speaking style.

## Packages

| path | what | deploys to |
|------|------|-----------|
| `packages/shared` | TS contracts: `MetricEvent`, `PipelineConfig`, `SessionInit` | (source only) |
| `packages/worker` | Cloudflare Worker: `POST /api/token` | Cloudflare |
| `packages/frontend` | Vite + React SPA: mic/audio + live dashboard | Cloudflare Pages |
| `agent/` | Python LiveKit agent: the pipeline + all measurement | Docker on a VM |

## Prerequisites

- Node 20+ and `pnpm`
- Docker (for the local LiveKit + agent stack) **or** Python 3.11+ (to run the agent bare)
- Your own Deepgram, OpenRouter, and ElevenLabs API keys (entered in the browser)
- (Only for the Cloud path) a [LiveKit Cloud](https://cloud.livekit.io) project

## Setup & run (Phase 1)

The **LiveKit server** and **agent worker** can run two ways. The **Worker**
(token API) and **frontend** always run on the host. Pick A or B, then do the
common host steps.

### A. Fully local (Docker) — offline, no accounts

Runs `livekit-server` + the agent in containers. `docker-compose.yml` and
`infra/livekit.yaml` are pre-wired with dev credentials.

```bash
# Your LAN IP, so a host browser and the agent container can both reach
# containerized WebRTC media (compose reads this from a root .env file):
echo "NODE_IP=$(ipconfig getifaddr en0)" > .env        # macOS Wi-Fi (try en1 if empty)
# Linux: echo "NODE_IP=$(hostname -I | awk '{print $1}')" > .env

docker compose up --build     # livekit + agent; wait for "registered worker"
```

The worker's `wrangler.toml` already defaults `LIVEKIT_URL=ws://localhost:7880`,
so no edits are needed. Dev creds live in `infra/livekit.yaml`.

> Editing agent code? Re-run `docker compose up --build` (code is baked into the
> image; a bind-mount would require adding this path to Docker Desktop → Resources
> → File Sharing). Or run the agent bare — see [`agent/README.md`](agent/README.md).

### B. LiveKit Cloud + local agent

One-time: create a [LiveKit Cloud](https://cloud.livekit.io) project and set up
the agent venv:

```bash
cp .env.cloud.example .env.cloud          # fill in LIVEKIT_URL / KEY / SECRET
cd agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt \
  && .venv/bin/python src/main.py download-files && cd ..
```

Then everything starts with one command (agent + worker + frontend, Ctrl-C
stops all three):

```bash
pnpm dev:cloud
```

### Common host steps (both A and B)

```bash
pnpm install

# Worker (token API) — for Docker, .dev.vars uses the baked dev creds:
cd packages/worker
printf 'LIVEKIT_API_KEY=devkey\nLIVEKIT_API_SECRET=devsecret0123456789abcdef0123456789\n' > .dev.vars
pnpm dev                        # -> http://localhost:8787  (for Cloud, use your real creds)

# Frontend (new terminal):
cd packages/frontend
echo "VITE_WORKER_URL=http://localhost:8787/api" > .env.local
pnpm dev                        # -> http://localhost:5173
```

Open http://localhost:5173, paste your three API keys, click **Start**, grant mic
access, and speak. The six headline latency numbers update per turn, the
transcript streams live as you talk, and **Prompt & turn detection → Edit**
opens the tuning panel.

## EU data residency

Every provider hop is configurable, so an all-EU pipeline is a config choice,
not a fork. The pieces:

| Hop | EU option | How |
|-----|-----------|-----|
| Media / SFU | LiveKit Cloud EU region, or self-host `livekit-server` on an EU VM (Hetzner etc. — this repo's Docker setup runs anywhere) | pick region at project creation / deploy `infra/` |
| Agent worker | any EU datacenter VM | `agent/` Docker image |
| STT | Deepgram EU endpoint (plan-dependent — verify with Deepgram) | `stt.options.baseUrl: "https://api.eu.deepgram.com/v1/listen"` |
| LLM | Nebius AI Studio (EU datacenters, OpenAI-compatible), Azure OpenAI in an EU region (swedencentral, francecentral), or any EU OpenAI-compatible endpoint | providers `nebius` / `azure` (built in), or `llm.options.baseUrl` |
| TTS | ElevenLabs EU residency (enterprise tier), or add an EU-residency TTS provider (Inworld, Azure EU) as a new branch | `tts.options.baseUrl`, or one branch in `agent/src/providers.py` |

Provider config shapes: `nebius` takes a model id (`llm: { provider: "nebius",
model: "..." }`, key id `nebius`); `azure` additionally needs
`options.endpoint` (`https://<resource>.openai.azure.com`), optional
`options.deployment` (defaults to the model name) and `options.apiVersion`,
key id `azure`.

Caveats worth knowing before you promise residency to anyone: OpenRouter routes
to wherever the underlying model hosts run — use a direct EU endpoint (Nebius,
Azure EU) instead when residency matters. And "EU endpoint" claims vary by
provider plan; confirm in writing what region actually processes audio/text.

## Troubleshooting

**`ICE failed` in the console; stuck on "connecting" (signaling connects, then
media fails).** The SFU is advertising a media IP your browser can't reach —
almost always a stale `NODE_IP` after your machine got a new DHCP lease (new
Wi-Fi network, router restart). Refresh it and recreate the SFU:

```bash
echo "NODE_IP=$(ipconfig getifaddr en0)" > .env      # Linux: hostname -I | awk '{print $1}'
docker compose up -d --force-recreate livekit
```

On recent macOS also check **System Settings → Privacy & Security → Local
Network**: your browser needs permission to reach your own LAN IP (localhost is
exempt, which is why signaling still works). Quick test: open
`http://<your-LAN-IP>:7880` in the browser — LiveKit should answer "OK".

**The agent talks to itself / your transcript shows the agent's words as
"you" / replies cut off mid-sentence.** Acoustic feedback: the agent's voice
from your speakers re-enters the mic, is transcribed as user speech, and
triggers barge-in — the agent interrupts itself. Echo cancellation is enabled,
but browser AEC on open laptop speakers is unreliable (Firefox on macOS
especially). **Use headphones** — this eliminates it completely. Chrome's AEC
also copes noticeably better than Firefox's if you must use speakers.

**Mic connects but nothing answers.** The agent isn't in the room — you should
always hear the greeting within a couple of seconds of starting a call. Check
`docker compose ps` (is the agent up?) and `docker compose logs agent` for
`registered worker`. Remember agent code is baked into the image: after editing
`agent/src/*`, re-run `docker compose up -d --build agent`.

## Roadmap

- **Phase 1:** one hardcoded pipeline, live metrics. ✅
- **Phase 1.5:** semantic turn detection with tunable endpointing, live
  streaming transcripts, EOU latency breakdown. ✅
- **Phase 2:** swappable STT/LLM/TTS via dropdowns, cost panel, latency timeline.
- **Phase 3+:** comparison mode, persistence, telephony. (See the project spec.)

## Contributing

PRs welcome. The guardrails that keep this codebase small:

- **Adding a provider** = one entry in `packages/frontend/src/data/providers.ts`
  plus one branch in `agent/src/providers.py`. Nothing else changes.
- **All timing on one clock** — every stage becomes the same `MetricEvent` shape,
  timestamped on the agent. Don't measure a stage differently.
- **BYOK boundary** — provider keys stay out of `PipelineConfig`, out of logs,
  and out of env vars. Use the individual LiveKit plugins (which accept
  `api_key=`), never the hosted inference gateway.

## License

MIT
