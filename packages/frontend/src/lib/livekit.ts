import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteParticipant,
} from "livekit-client";
import {
  METRICS_TOPIC,
  SESSION_INIT_TOPIC,
  TRANSCRIPT_TOPIC,
  type MetricEvent,
  type SessionInit,
  type TranscriptEvent,
} from "@voice-playground/shared";
import { metricsStore } from "./metricsStore";
import { transcriptStore } from "./transcriptStore";

// The browser talks to ONLY two things: the Worker (fetch a token) and the
// LiveKit room (WebRTC media + data channel). It NEVER calls a provider SDK.

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? "http://localhost:8787/api";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface VoiceSession {
  room: Room;
  disconnect: () => Promise<void>;
}

async function fetchToken(
  roomName: string,
  identity: string,
): Promise<{ token: string; url: string }> {
  const res = await fetch(`${WORKER_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName, identity }),
  });
  if (!res.ok) {
    throw new Error(`token request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function attachAudio(track: RemoteTrack): HTMLAudioElement | undefined {
  if (track.kind !== Track.Kind.Audio) return undefined;
  const el = track.attach() as HTMLAudioElement;
  el.autoplay = true;
  el.style.display = "none";
  document.body.appendChild(el);
  return el;
}

/**
 * Connect to a room, hand the agent the SessionInit (config + BYOK keys) over
 * the reliable "session-init" data topic, publish the mic, wire remote audio
 * playback, and stream MetricEvents into the metricsStore.
 */
export async function startSession(init: SessionInit): Promise<VoiceSession> {
  metricsStore.reset();
  transcriptStore.reset();

  const roomName = `playground-${Math.floor(performance.now())}`;
  const identity = `user-${Math.floor(performance.now())}`;
  const { token, url } = await fetchToken(roomName, identity);

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    // Explicit AEC/NS: without it, speaker output loops into the mic, gets
    // transcribed as user speech, and barge-in makes the agent interrupt
    // itself. Browser AEC quality still varies (Firefox+speakers is weak) —
    // headphones are the reliable fix; see README troubleshooting.
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // Config + keys for the agent. The agent joins a moment AFTER us and LiveKit
  // does NOT buffer data messages for late joiners — so we (re)send this when
  // the agent participant appears, with a short retry burst to cover the agent
  // attaching its data handler. The agent ignores all but the first.
  const initPayload = encoder.encode(JSON.stringify(init));
  const sendInit = () => {
    room.localParticipant
      .publishData(initPayload, { reliable: true, topic: SESSION_INIT_TOPIC })
      .catch((err) => console.error("failed to send session-init", err));
  };

  room.on(RoomEvent.ParticipantConnected, () => {
    sendInit();
    setTimeout(sendInit, 600);
    setTimeout(sendInit, 1500);
  });

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
    attachAudio(track);
  });

  room.on(
    RoomEvent.DataReceived,
    (payload: Uint8Array, _p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (topic !== METRICS_TOPIC && topic !== TRANSCRIPT_TOPIC) return;
      try {
        const parsed = JSON.parse(decoder.decode(payload));
        if (topic === TRANSCRIPT_TOPIC) {
          const ev = parsed as TranscriptEvent;
          transcriptStore.ingest(ev);
          // Finalized text is turn-correlated by speech_id on the agent.
          if (ev.final && ev.turnId) metricsStore.setTurnText(ev.turnId, ev.role, ev.text);
        } else {
          metricsStore.ingest(parsed as MetricEvent);
        }
      } catch (err) {
        console.error("failed to parse agent event", err);
      }
    },
  );

  await room.connect(url, token);

  // If the agent was already in the room when we connected, send immediately.
  if (room.remoteParticipants.size > 0) sendInit();

  await room.localParticipant.setMicrophoneEnabled(true);

  return {
    room,
    disconnect: async () => {
      await room.disconnect();
    },
  };
}
