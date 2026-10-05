import type { BYOKKeys, TurnDetectionConfig, VoiceConfig } from "@voice-playground/shared";
import { DEFAULT_PIPELINE, REQUIRED_KEYS, VOICES } from "../data/providers";
import type { AssistantPreset } from "../lib/presetStore";
import { STAGES, type StageKey } from "../lib/stages";
import { ghostBtnCls, headingCls, inputCls, labelCls, panelCls, secondaryBtnCls } from "../lib/ui";

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

const PROVIDER_LABEL: Record<string, string> = {
  deepgram: "Deepgram",
  openrouter: "OpenRouter",
  elevenlabs: "ElevenLabs",
};

const providerName = (id: string) => PROVIDER_LABEL[id] ?? id;

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
  const voiceLabel = VOICES.find((v) => v.id === voice.voiceId)?.label ?? "custom voice";
  const { stt, llm, tts } = DEFAULT_PIPELINE;
  const rows: { stage: StageKey; title: string; detail: string }[] = [
    {
      stage: "eou",
      title: STAGES.eou.label,
      detail: `${td.model === "english" ? "English" : "Multilingual"} model, ${td.minDelay ?? 0.4}–${td.maxDelay ?? 3.0}s${
        td.mode === "dynamic" ? ", dynamic" : ""
      }`,
    },
    { stage: "stt", title: providerName(stt.provider), detail: `${stt.model}, ${language}` },
    { stage: "llm", title: providerName(llm.provider), detail: llm.model },
    { stage: "tts", title: providerName(tts.provider), detail: `${tts.model}, ${voiceLabel}` },
  ];

  return (
    <section className={`${panelCls} divide-y divide-line`}>
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className={headingCls}>Assistant</h2>
          <div className="-mr-2 flex">
            <button type="button" disabled={disabled} onClick={onNewPreset} className={ghostBtnCls}>
              New
            </button>
            <button type="button" disabled={disabled} onClick={onDuplicatePreset} className={ghostBtnCls}>
              Duplicate
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onDeletePreset}
              className={`${ghostBtnCls} hover:text-bad`}
            >
              Delete
            </button>
          </div>
        </div>
        <select
          aria-label="Assistant"
          disabled={disabled}
          value={activePresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
          className={inputCls}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onOpenSettings}
          className="group block w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-left transition-colors hover:border-faint"
        >
          <span className="flex items-center justify-between text-[13px] text-muted">
            Prompt, voice and turn settings
            <span className="text-fg opacity-60 transition-opacity group-hover:opacity-100">Edit</span>
          </span>
          <span className="mt-1 line-clamp-2 text-[13px] leading-snug text-fg/80">
            {systemPrompt || "No system prompt yet."}
          </span>
        </button>
      </div>

      <div className="space-y-3 p-5">
        <h2 className={headingCls}>Pipeline</h2>
        <ol className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.stage} className="grid grid-cols-[10px_1fr] items-baseline gap-x-3">
              <span aria-hidden className={`h-2.5 w-2.5 translate-y-0.5 rounded-sm ${STAGES[r.stage].bg}`} />
              <span className="min-w-0">
                <span className="block text-sm">{r.title}</span>
                <span className="block truncate text-[13px] text-muted">{r.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3 p-5">
        <h2 className={headingCls}>API keys</h2>
        {REQUIRED_KEYS.map((k) => (
          <label key={k.id} className="block space-y-1.5">
            <span className={labelCls}>{providerName(k.id)}</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={keys[k.id] ?? ""}
              onChange={(e) => onKeyChange(k.id, e.target.value)}
              placeholder={`Paste your ${providerName(k.id)} key`}
              className={`${inputCls} font-mono text-[13px] placeholder:font-sans`}
            />
          </label>
        ))}
        <label className="flex cursor-pointer select-none items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={rememberKeys}
            onChange={(e) => onRememberKeysChange(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-[rgb(var(--fg))]"
          />
          <span className="text-[13px]">Remember keys on this device</span>
        </label>
        <p className="text-xs leading-relaxed text-faint">
          {rememberKeys
            ? "Stored in this browser only. Keys go nowhere except your live session."
            : "Keys go only into your live session and aren't stored. You'll re-enter them after a refresh."}
        </p>
      </div>

      <div className="p-5">
        <button type="button" onClick={onSave} className={`${secondaryBtnCls} w-full`}>
          Save assistant
        </button>
      </div>
    </section>
  );
}
