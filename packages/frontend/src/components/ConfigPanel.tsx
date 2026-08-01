import type { BYOKKeys, TurnDetectionConfig, VoiceConfig } from "@voice-playground/shared";
import { DEFAULT_PIPELINE, REQUIRED_KEYS, VOICES } from "../data/providers";
import type { AssistantPreset } from "../lib/presetStore";

interface Props {
  presets: AssistantPreset[];
  activePresetId: string;
  onSelectPreset: (id: string) => void;
  onNewPreset: () => void;
  onDuplicatePreset: () => void;
  onDeletePreset: () => void;
  keys: BYOKKeys;
  onKeyChange: (id: string, value: string) => void;
  rememberKeys: boolean;
  onRememberKeysChange: (value: boolean) => void;
  systemPrompt: string;
  language: string;
  turnDetection: TurnDetectionConfig;
  voice: VoiceConfig;
  onOpenSettings: () => void;
  onSave: () => void;
  disabled: boolean;
}

const presetBtnCls =
  "rounded-md bg-neutral-800/60 border border-neutral-700 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-200 hover:border-neutral-600 disabled:opacity-40 disabled:hover:text-neutral-400";

// Phase 1: providers/models are fixed (shown read-only). Only the BYOK keys are
// edited here; the system prompt + turn detection live in the Settings modal.
// Phase 2 turns the read-only rows into dropdowns.
export default function ConfigPanel({
  presets,
  activePresetId,
  onSelectPreset,
  onNewPreset,
  onDuplicatePreset,
  onDeletePreset,
  keys,
  onKeyChange,
  rememberKeys,
  onRememberKeysChange,
  systemPrompt,
  language,
  turnDetection,
  voice,
  onOpenSettings,
  onSave,
  disabled,
}: Props) {
  const td = turnDetection;
  const voiceLabel = VOICES.find((v) => v.id === voice.voiceId)?.label ?? "custom";
  const rows: { stage: string; value: string }[] = [
    { stage: "STT", value: `${DEFAULT_PIPELINE.stt.provider} · ${DEFAULT_PIPELINE.stt.model} · ${language}` },
    { stage: "LLM", value: `${DEFAULT_PIPELINE.llm.provider} · ${DEFAULT_PIPELINE.llm.model}` },
    { stage: "TTS", value: `${DEFAULT_PIPELINE.tts.provider} · ${DEFAULT_PIPELINE.tts.model} · ${voiceLabel}` },
    {
      stage: "Turn",
      value: `${td.model ?? "multilingual"} · ${td.minDelay ?? 0.4}–${td.maxDelay ?? 3.0}s${
        td.mode === "dynamic" ? " · dynamic" : ""
      }`,
    },
  ];

  return (
    <section className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-neutral-400">
          Assistant
        </h2>
        <select
          disabled={disabled}
          value={activePresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500/50 disabled:opacity-50"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <button type="button" disabled={disabled} onClick={onNewPreset} className={presetBtnCls}>
            New
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onDuplicatePreset}
            className={presetBtnCls}
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onDeletePreset}
            className={`${presetBtnCls} ml-auto hover:text-red-400 hover:border-red-500/40`}
          >
            Delete
          </button>
        </div>
      </div>

      <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-neutral-400">
        Pipeline
      </h2>

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.stage}
            className="flex items-center justify-between gap-3 rounded-lg bg-neutral-800/40 px-3 py-2 text-sm"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              {r.stage}
            </span>
            <span className="truncate font-mono text-xs text-neutral-300">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          Your API keys (BYOK)
        </h3>
        {REQUIRED_KEYS.map((k) => (
          <label key={k.id} className="block space-y-1">
            <span className="text-xs text-neutral-400">{k.label}</span>
            <input
              type="password"
              autoComplete="off"
              disabled={disabled}
              value={keys[k.id] ?? ""}
              onChange={(e) => onKeyChange(k.id, e.target.value)}
              placeholder={`sk-... (${k.id})`}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500/50 disabled:opacity-50"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberKeys}
            onChange={(e) => onRememberKeysChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-800 accent-emerald-500"
          />
          <span className="text-xs text-neutral-300">Remember keys on this device</span>
        </label>
        <p className="text-[11px] leading-relaxed text-neutral-500">
          {rememberKeys
            ? "Saved in this browser's local storage on this device only. Never sent anywhere but your live session."
            : "Sent only into your live session — not stored. Re-enter after a refresh."}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="w-full text-left rounded-lg bg-neutral-800/40 border border-neutral-700 px-3 py-2.5 transition-colors hover:bg-neutral-800/70"
      >
        <span className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            Prompt &amp; turn detection
          </span>
          <span className="text-xs text-neutral-400">Edit</span>
        </span>
        <span className="mt-1 block text-xs text-neutral-400 line-clamp-2">
          {systemPrompt || "No system prompt set."}
        </span>
      </button>

      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 active:scale-[0.99]"
      >
        Save
      </button>
    </section>
  );
}
