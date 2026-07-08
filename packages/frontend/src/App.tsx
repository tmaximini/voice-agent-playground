import { useCallback, useRef, useState } from "react";
import type { BYOKKeys, SessionInit, TurnDetectionConfig } from "@voice-playground/shared";
import { DEFAULT_PIPELINE, DEFAULT_TURN_DETECTION, REQUIRED_KEYS } from "./data/providers";
import { startSession, type VoiceSession } from "./lib/livekit";
import { loadJSON, remove, saveJSON } from "./lib/persist";
import ConfigPanel from "./components/ConfigPanel";
import CallControls, { type CallState } from "./components/CallControls";
import CostPanel from "./components/CostPanel";
import MetricsCards from "./components/MetricsCards";
import TranscriptLog from "./components/TranscriptLog";
import SettingsModal from "./components/SettingsModal";
import Toaster from "./components/Toaster";
import { toast } from "./lib/toast";

// Waveform mark: five bars that idle flat and breathe while the call is live.
function LogoMark({ live }: { live: boolean }) {
  const heights = [10, 18, 26, 16, 8];
  return (
    <div
      aria-hidden
      className={`flex h-9 w-9 items-center justify-center gap-[3px] rounded-lg bg-emerald-500/10 border border-emerald-500/30 ${
        live ? "logo-live" : ""
      }`}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="logo-bar w-[3px] rounded-full bg-emerald-400"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [rememberKeys, setRememberKeys] = useState<boolean>(() =>
    loadJSON("rememberKeys", false),
  );
  const [keys, setKeys] = useState<BYOKKeys>(() =>
    loadJSON("rememberKeys", false) ? loadJSON<BYOKKeys>("keys", {}) : {},
  );
  const [systemPrompt, setSystemPrompt] = useState(() =>
    loadJSON("systemPrompt", DEFAULT_PIPELINE.systemPrompt ?? ""),
  );
  const [language, setLanguage] = useState(() => loadJSON("language", "multi"));
  const [turnDetection, setTurnDetection] = useState<TurnDetectionConfig>(() =>
    loadJSON("turnDetection", DEFAULT_TURN_DETECTION),
  );
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sessionRef = useRef<VoiceSession | null>(null);

  // Explicit save: persists the system prompt (non-sensitive) always, and the
  // BYOK keys only when the user opted in. Toggling "remember" off + Save wipes them.
  const onSave = useCallback(() => {
    saveJSON("systemPrompt", systemPrompt);
    saveJSON("language", language);
    saveJSON("turnDetection", turnDetection);
    saveJSON("rememberKeys", rememberKeys);
    if (rememberKeys) saveJSON("keys", keys);
    else remove("keys");
    toast(rememberKeys ? "Saved — keys stored on this device" : "Saved");
  }, [systemPrompt, language, turnDetection, rememberKeys, keys]);

  const canStart = REQUIRED_KEYS.every((k) => (keys[k.id] ?? "").trim().length > 0);

  const onKeyChange = useCallback((id: string, value: string) => {
    setKeys((prev) => ({ ...prev, [id]: value }));
  }, []);

  const onStart = useCallback(async () => {
    setError(undefined);
    setState("connecting");
    try {
      const init: SessionInit = {
        config: {
          ...DEFAULT_PIPELINE,
          stt: {
            ...DEFAULT_PIPELINE.stt,
            options: { ...DEFAULT_PIPELINE.stt.options, language },
          },
          turnDetection,
          systemPrompt,
        },
        keys,
      };
      sessionRef.current = await startSession(init);
      sessionRef.current.room.on("disconnected", () => {
        sessionRef.current = null;
        setState("idle");
      });
      setState("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [keys, systemPrompt, language, turnDetection]);

  const onStop = useCallback(async () => {
    await sessionRef.current?.disconnect();
    sessionRef.current = null;
    setState("idle");
  }, []);

  const disabled = state === "live" || state === "connecting";

  return (
    <div className="min-h-screen mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-4">
        <LogoMark live={state === "live"} />
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">AI Voice Playground</h1>
          <p className="text-sm text-neutral-400">
            Bring your own keys. Hold a spoken conversation. Watch per-turn latency live.
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-[320px_1fr] gap-6 items-start">
        <div className="space-y-6">
          <ConfigPanel
            keys={keys}
            onKeyChange={onKeyChange}
            rememberKeys={rememberKeys}
            onRememberKeysChange={setRememberKeys}
            systemPrompt={systemPrompt}
            language={language}
            turnDetection={turnDetection}
            onOpenSettings={() => setSettingsOpen(true)}
            onSave={onSave}
            disabled={disabled}
          />
        </div>

        <div className="space-y-6">
          <CallControls
            state={state}
            error={error}
            canStart={canStart}
            onStart={onStart}
            onStop={onStop}
          />
          <MetricsCards />
          <TranscriptLog />
          <CostPanel />
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
        language={language}
        onLanguageChange={setLanguage}
        turnDetection={turnDetection}
        onTurnDetectionChange={setTurnDetection}
        onSave={onSave}
        disabled={disabled}
      />
      <Toaster />
    </div>
  );
}
