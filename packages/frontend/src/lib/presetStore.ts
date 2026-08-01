import { useSyncExternalStore } from "react";
import type { TurnDetectionConfig, VoiceConfig } from "@voice-playground/shared";
import { DEFAULT_PIPELINE, DEFAULT_TURN_DETECTION, DEFAULT_VOICE } from "../data/providers";
import { loadJSON, remove as removeKey, saveJSON } from "./persist";

// Named assistant presets: a preset bundles the non-sensitive session config
// (system prompt, STT language, turn-detection profile, TTS voice). BYOK keys
// are global and deliberately NOT part of a preset. Persisted to localStorage;
// there is always at least one preset.

export interface AssistantPreset {
  id: string;
  name: string;
  systemPrompt: string;
  language: string;
  turnDetection: TurnDetectionConfig;
  voice: VoiceConfig;
}

const KEY = "presets";
const ACTIVE_KEY = "activePreset";

function newId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultPreset(name: string): AssistantPreset {
  return {
    id: newId(),
    name,
    systemPrompt: DEFAULT_PIPELINE.systemPrompt ?? "",
    language: "multi",
    turnDetection: { ...DEFAULT_TURN_DETECTION },
    voice: { ...DEFAULT_VOICE },
  };
}

// Pre-preset versions stored prompt/language/turnDetection as flat keys —
// fold them into a "Default" preset once, then drop the legacy keys.
function migrateLegacy(): AssistantPreset {
  const p: AssistantPreset = {
    id: newId(),
    name: "Default",
    systemPrompt: loadJSON("systemPrompt", DEFAULT_PIPELINE.systemPrompt ?? ""),
    language: loadJSON("language", "multi"),
    turnDetection: loadJSON<TurnDetectionConfig>("turnDetection", { ...DEFAULT_TURN_DETECTION }),
    voice: { ...DEFAULT_VOICE },
  };
  removeKey("systemPrompt");
  removeKey("language");
  removeKey("turnDetection");
  return p;
}

type Listener = () => void;

class PresetStore {
  private presets: AssistantPreset[];
  private activeId: string;
  private listeners = new Set<Listener>();

  constructor() {
    const stored = loadJSON<AssistantPreset[]>(KEY, []);
    // Presets saved before the voice field existed get the default voice.
    this.presets =
      stored.length > 0
        ? stored.map((p) => ({ ...p, voice: { ...DEFAULT_VOICE, ...p.voice } }))
        : [migrateLegacy()];
    const active = loadJSON<string>(ACTIVE_KEY, this.presets[0].id);
    this.activeId = this.presets.some((p) => p.id === active) ? active : this.presets[0].id;
    if (stored.length === 0) this.persist();
  }

  getActive(): AssistantPreset {
    return this.presets.find((p) => p.id === this.activeId) ?? this.presets[0];
  }

  setActive(id: string): void {
    if (!this.presets.some((p) => p.id === id)) return;
    this.activeId = id;
    this.persist();
  }

  update(id: string, patch: Partial<Omit<AssistantPreset, "id">>): void {
    this.presets = this.presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    this.persist();
  }

  /** Create a fresh preset from defaults and make it active. */
  create(): AssistantPreset {
    const n = this.presets.length + 1;
    const p = defaultPreset(`Assistant ${n}`);
    this.presets = [...this.presets, p];
    this.activeId = p.id;
    this.persist();
    return p;
  }

  /** Copy an existing preset and make the copy active. */
  duplicate(id: string): AssistantPreset {
    const src = this.presets.find((p) => p.id === id) ?? this.getActive();
    const copy: AssistantPreset = {
      ...src,
      id: newId(),
      name: `${src.name} (copy)`,
      turnDetection: { ...src.turnDetection },
      voice: { ...src.voice },
    };
    this.presets = [...this.presets, copy];
    this.activeId = copy.id;
    this.persist();
    return copy;
  }

  /** Delete a preset; the list never goes empty. Returns the new active preset. */
  remove(id: string): AssistantPreset {
    this.presets = this.presets.filter((p) => p.id !== id);
    if (this.presets.length === 0) this.presets = [defaultPreset("Default")];
    if (this.activeId === id) this.activeId = this.presets[0].id;
    this.persist();
    return this.getActive();
  }

  private persist(): void {
    saveJSON(KEY, this.presets);
    saveJSON(ACTIVE_KEY, this.activeId);
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): AssistantPreset[] => this.presets;
  getActiveId = (): string => this.activeId;
}

export const presetStore = new PresetStore();

/** React hook: all presets, in creation order. */
export function usePresets(): AssistantPreset[] {
  return useSyncExternalStore(presetStore.subscribe, presetStore.getSnapshot);
}

/** React hook: id of the active preset. */
export function useActivePresetId(): string {
  return useSyncExternalStore(presetStore.subscribe, presetStore.getActiveId);
}
