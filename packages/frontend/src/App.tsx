import { useCallback, useRef, useState } from "react";
import type { BYOKKeys, SessionInit, TurnDetectionConfig, VoiceConfig } from "@voice-playground/shared";
import { DEFAULT_PIPELINE, REQUIRED_KEYS } from "./data/providers";
import { startSession, type VoiceSession } from "./lib/livekit";
import { loadJSON, remove, saveJSON } from "./lib/persist";
import { metricsStore, useTurns } from "./lib/metricsStore";
import { sessionHistory } from "./lib/sessionHistory";
import { estimateCost } from "./lib/cost";
import { presetStore, useActivePresetId, usePresets } from "./lib/presetStore";
import ConfigPanel from "./components/ConfigPanel";
import CallControls, { type CallState } from "./components/CallControls";
import CostPanel from "./components/CostPanel";
import HistoryPanel from "./components/HistoryPanel";
import TurnPanel from "./components/TurnPanel";
import TranscriptLog from "./components/TranscriptLog";
import SettingsModal from "./components/SettingsModal";
import Toaster from "./components/Toaster";
import { toast } from "./lib/toast";

// Mark: one bar per pipeline stage, in stage colors. Idle flat, breathing live.
function LogoMark({ live }: { live: boolean }) {
  const bars = [
    { h: 12, c: "bg-stage-eou" },
    { h: 22, c: "bg-stage-stt" },
    { h: 16, c: "bg-stage-llm" },
    { h: 9, c: "bg-stage-tts" },
  ];
  return (
    <div
      aria-hidden
      className={`flex h-9 w-9 items-center justify-center gap-[3px] rounded-[10px] border border-line bg-panel ${
        live ? "logo-live" : ""
      }`}
    >
      {bars.map((b, i) => (
        <span key={i} className={`logo-bar w-[3px] rounded-full ${b.c}`} style={{ height: b.h }} />
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
  // Working copy of the active preset. Editing here is unsaved until Save
  // writes it back to the preset; switching presets replaces the working copy.
  const presets = usePresets();
  const activePresetId = useActivePresetId();
  const [presetName, setPresetName] = useState(() => presetStore.getActive().name);
  const [systemPrompt, setSystemPrompt] = useState(() => presetStore.getActive().systemPrompt);
  const [language, setLanguage] = useState(() => presetStore.getActive().language);
  const [turnDetection, setTurnDetection] = useState<TurnDetectionConfig>(() => ({
    ...presetStore.getActive().turnDetection,
  }));
  const [voice, setVoice] = useState<VoiceConfig>(() => ({ ...presetStore.getActive().voice }));
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  // Turn shown in the turn panel; undefined follows the newest turn.
  const [selectedTurnId, setSelectedTurnId] = useState<string>();
  const turns = useTurns();
  const selectedIdx = selectedTurnId ? turns.findIndex((t) => t.turnId === selectedTurnId) : -1;
  const shownIdx = selectedIdx >= 0 ? selectedIdx : 0;
  const sessionRef = useRef<VoiceSession | null>(null);
  const startedAtRef = useRef(0);
  const savedRef = useRef(false);

  // Archive the finished call to localStorage (HistoryPanel). Runs on both
  // manual stop and remote disconnect — idempotent via savedRef, since
  // room.disconnect() also fires the "disconnected" event.
  const finishSession = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    const turns = [...metricsStore.getSnapshot()].reverse(); // stored oldest-first
    if (turns.length === 0) return;
    const usage = metricsStore.getUsage();
    const config = {
      llmModel: DEFAULT_PIPELINE.llm.model,
      sttProvider: DEFAULT_PIPELINE.stt.provider,
      ttsProvider: DEFAULT_PIPELINE.tts.provider,
      language,
      preset: presetStore.getActive().name,
    };
    sessionHistory.add({
      id: `s-${startedAtRef.current}`,
      startedAt: startedAtRef.current,
      durationMs: Date.now() - startedAtRef.current,
      turns,
      usage,
      costUsd: estimateCost(usage, config).total,
      config,
    });
  }, [language]);

  // Explicit save: writes the working copy back to the active preset, and the
  // BYOK keys only when the user opted in. Toggling "remember" off + Save wipes them.
  const onSave = useCallback(() => {
    presetStore.update(activePresetId, {
      name: presetName.trim() || "Untitled",
      systemPrompt,
      language,
      turnDetection,
      voice,
    });
    saveJSON("rememberKeys", rememberKeys);
    if (rememberKeys) saveJSON("keys", keys);
    else remove("keys");
    toast(rememberKeys ? "Assistant saved. Keys stored on this device." : "Assistant saved");
  }, [activePresetId, presetName, systemPrompt, language, turnDetection, voice, rememberKeys, keys]);

  // Load a preset into the working copy (discards unsaved edits).
  const loadPreset = useCallback((p: ReturnType<typeof presetStore.getActive>) => {
    setPresetName(p.name);
    setSystemPrompt(p.systemPrompt);
    setLanguage(p.language);
    setTurnDetection({ ...p.turnDetection });
    setVoice({ ...p.voice });
  }, []);

  const onSelectPreset = useCallback(
    (id: string) => {
      presetStore.setActive(id);
      loadPreset(presetStore.getActive());
    },
    [loadPreset],
  );

  const onNewPreset = useCallback(() => {
    loadPreset(presetStore.create());
    setSettingsOpen(true);
  }, [loadPreset]);

  const onDuplicatePreset = useCallback(() => {
    loadPreset(presetStore.duplicate(presetStore.getActiveId()));
  }, [loadPreset]);

  const onDeletePreset = useCallback(() => {
    const active = presetStore.getActive();
    if (!window.confirm(`Delete assistant "${active.name}"?`)) return;
    loadPreset(presetStore.remove(active.id));
  }, [loadPreset]);

  const canStart = REQUIRED_KEYS.every((k) => (keys[k.id] ?? "").trim().length > 0);

  const onKeyChange = useCallback((id: string, value: string) => {
    setKeys((prev) => ({ ...prev, [id]: value }));
  }, []);

  const onStart = useCallback(async () => {
    setError(undefined);
    setState("connecting");
    startedAtRef.current = Date.now();
    setStartedAt(startedAtRef.current);
    setSelectedTurnId(undefined);
    savedRef.current = false;
    try {
      const init: SessionInit = {
        config: {
          ...DEFAULT_PIPELINE,
          stt: {
            ...DEFAULT_PIPELINE.stt,
            options: { ...DEFAULT_PIPELINE.stt.options, language },
          },
          tts: {
            ...DEFAULT_PIPELINE.tts,
            options: {
              ...DEFAULT_PIPELINE.tts.options,
              voiceId: voice.voiceId,
              voiceSettings: {
                stability: voice.stability,
                similarityBoost: voice.similarityBoost,
                style: voice.style,
                speed: voice.speed,
              },
            },
          },
          turnDetection,
          systemPrompt,
        },
        keys,
      };
      sessionRef.current = await startSession(init);
      sessionRef.current.room.on("disconnected", () => {
        finishSession();
        sessionRef.current = null;
        setState("idle");
      });
      setState("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [keys, systemPrompt, language, turnDetection, voice, finishSession]);

  const onStop = useCallback(async () => {
    await sessionRef.current?.disconnect();
    finishSession();
    sessionRef.current = null;
    setState("idle");
  }, [finishSession]);

  const disabled = state === "live" || state === "connecting";

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-6">
        <LogoMark live={state === "live"} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Voice Playground</h1>
          <p className="text-[13px] text-muted">
            Talk to a voice agent with your own keys and see where every millisecond goes.
          </p>
        </div>
      </header>

      <div className="grid items-start gap-5 md:grid-cols-[300px_1fr]">
        <aside>
          <ConfigPanel
            presets={presets}
            activePresetId={activePresetId}
            onSelectPreset={onSelectPreset}
            onNewPreset={onNewPreset}
            onDuplicatePreset={onDuplicatePreset}
            onDeletePreset={onDeletePreset}
            keys={keys}
            onKeyChange={onKeyChange}
            rememberKeys={rememberKeys}
            onRememberKeysChange={setRememberKeys}
            systemPrompt={systemPrompt}
            language={language}
            turnDetection={turnDetection}
            voice={voice}
            onOpenSettings={() => setSettingsOpen(true)}
            onSave={onSave}
            disabled={disabled}
          />
        </aside>

        <main className="min-w-0 space-y-5">
          <CallControls
            state={state}
            error={error}
            canStart={canStart}
            assistantName={presetName.trim() || "your assistant"}
            startedAt={startedAt}
            onStart={onStart}
            onStop={onStop}
          />
          <TurnPanel
            turn={turns[shownIdx]}
            index={turns.length - shownIdx}
            total={turns.length}
            onShowLatest={() => setSelectedTurnId(undefined)}
          />
          <TranscriptLog
            turns={turns}
            selectedId={turns[shownIdx]?.turnId}
            onSelect={(id) => setSelectedTurnId(id === turns[0]?.turnId ? undefined : id)}
          />
          <CostPanel />
          <HistoryPanel />
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        presetName={presetName}
        onPresetNameChange={setPresetName}
        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
        language={language}
        onLanguageChange={setLanguage}
        turnDetection={turnDetection}
        onTurnDetectionChange={setTurnDetection}
        voice={voice}
        onVoiceChange={setVoice}
        onSave={onSave}
        disabled={disabled}
      />
      <Toaster />
    </div>
  );
}
