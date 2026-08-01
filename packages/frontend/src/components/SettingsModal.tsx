import type { TurnDetectionConfig, VoiceConfig } from "@voice-playground/shared";
import { LANGUAGES, VOICES } from "../data/providers";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  turnDetection: TurnDetectionConfig;
  onTurnDetectionChange: (value: TurnDetectionConfig) => void;
  voice: VoiceConfig;
  onVoiceChange: (value: VoiceConfig) => void;
  onSave: () => void;
  disabled: boolean;
}

const inputCls =
  "w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50";
const labelCls = "text-xs text-neutral-400";

// Roomy home for the system prompt and turn-detection tuning. Phase 2 can add
// provider/model/voice selection and cost settings here.
export default function SettingsModal({
  open,
  onClose,
  presetName,
  onPresetNameChange,
  systemPrompt,
  onSystemPromptChange,
  language,
  onLanguageChange,
  turnDetection,
  onTurnDetectionChange,
  voice,
  onVoiceChange,
  onSave,
  disabled,
}: Props) {
  const td = turnDetection;
  const set = (patch: Partial<TurnDetectionConfig>) =>
    onTurnDetectionChange({ ...td, ...patch });
  const setVoice = (patch: Partial<VoiceConfig>) => onVoiceChange({ ...voice, ...patch });
  const isKnownVoice = VOICES.some((v) => v.id === voice.voiceId);

  const slider = (
    label: string,
    key: "stability" | "similarityBoost" | "style" | "speed",
    min: number,
    max: number,
    fallback: number,
  ) => {
    const value = voice[key] ?? fallback;
    return (
      <label className="block space-y-1">
        <span className={`${labelCls} flex justify-between`}>
          {label}
          <span className="font-mono tabular-nums text-neutral-500">{value.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={0.05}
          disabled={disabled}
          value={value}
          onChange={(e) => setVoice({ [key]: Number(e.target.value) })}
          className="w-full accent-emerald-500"
        />
      </label>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-5">
        <label className="block space-y-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            Assistant name
          </span>
          <input
            type="text"
            autoFocus
            disabled={disabled}
            value={presetName}
            onChange={(e) => onPresetNameChange(e.target.value)}
            placeholder="e.g. Lena — pharmacy support"
            className={inputCls}
          />
        </label>

        <label className="block space-y-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            System prompt
          </span>
          <textarea
            rows={6}
            disabled={disabled}
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="Instructions that shape how the agent speaks and behaves…"
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-3 text-sm leading-relaxed outline-none focus:border-neutral-500 disabled:opacity-50 resize-y"
          />
        </label>

        <div className="space-y-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            Voice (ElevenLabs)
          </span>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className={labelCls}>Voice</span>
              <select
                disabled={disabled}
                value={isKnownVoice ? voice.voiceId : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") setVoice({ voiceId: e.target.value });
                }}
                className={inputCls}
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.hint}
                  </option>
                ))}
                <option value="custom">Custom voice ID…</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className={labelCls}>Voice ID (any from your library)</span>
              <input
                type="text"
                disabled={disabled}
                value={voice.voiceId}
                onChange={(e) => setVoice({ voiceId: e.target.value.trim() })}
                placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                className={`${inputCls} font-mono text-xs`}
              />
            </label>

            {slider("Stability (lower = expressive)", "stability", 0, 1, 0.5)}
            {slider("Similarity", "similarityBoost", 0, 1, 0.75)}
            {slider("Style exaggeration", "style", 0, 1, 0)}
            {slider("Speed", "speed", 0.8, 1.2, 1.0)}
          </div>

          <p className="text-[11px] text-neutral-500">
            Lower stability sounds livelier but less consistent; style &gt; 0 adds latency.
            Deep male tones: Adam or Josh. Soft female: Sarah or Rachel.
          </p>
        </div>

        <div className="space-y-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            Turn detection
          </span>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className={labelCls}>Language (STT)</span>
              <select
                disabled={disabled}
                value={language}
                onChange={(e) => {
                  onLanguageChange(e.target.value);
                  // English sessions get the smaller/faster English EOU model.
                  set({ model: e.target.value === "en" ? "english" : "multilingual" });
                }}
                className={inputCls}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className={labelCls}>EOU model</span>
              <select
                disabled={disabled}
                value={td.model ?? "multilingual"}
                onChange={(e) =>
                  set({ model: e.target.value as TurnDetectionConfig["model"] })
                }
                className={inputCls}
              >
                <option value="multilingual">Multilingual</option>
                <option value="english">English (faster)</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className={labelCls}>Endpointing</span>
              <select
                disabled={disabled}
                value={td.mode ?? "fixed"}
                onChange={(e) => set({ mode: e.target.value as TurnDetectionConfig["mode"] })}
                className={inputCls}
              >
                <option value="fixed">Fixed delay</option>
                <option value="dynamic">Dynamic (adapts to speaker)</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className={labelCls}>EOU unlikely threshold</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                disabled={disabled}
                value={td.unlikelyThreshold ?? ""}
                placeholder="per-language default"
                onChange={(e) =>
                  set({
                    unlikelyThreshold:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </label>

            <label className="block space-y-1">
              <span className={labelCls}>Min delay (s)</span>
              <input
                type="number"
                step="0.05"
                min="0"
                disabled={disabled}
                value={td.minDelay ?? 0.4}
                onChange={(e) => set({ minDelay: Number(e.target.value) })}
                className={inputCls}
              />
            </label>

            <label className="block space-y-1">
              <span className={labelCls}>Max delay (s)</span>
              <input
                type="number"
                step="0.5"
                min="0"
                disabled={disabled}
                value={td.maxDelay ?? 3.0}
                onChange={(e) => set({ maxDelay: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={disabled}
              checked={td.preemptiveTts ?? true}
              onChange={(e) => set({ preemptiveTts: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-800 accent-emerald-500"
            />
            <span className="text-xs text-neutral-300">
              Preemptive TTS — lowest latency, but retracted turns still bill TTS characters
            </span>
          </label>

          <p className="text-[11px] text-neutral-500">
            The semantic model decides if you sound finished: confident end-of-turn commits
            after the min delay of silence; unfinished-sounding speech waits up to the max.
            Lower min delay = snappier but more likely to talk over slow speakers.
          </p>
        </div>

        <p className="text-[11px] text-neutral-500">
          {disabled
            ? "Stop the call to edit — settings are applied when a call starts."
            : "Applied when you start a call."}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-100/5 border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-100/10"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave();
              onClose();
            }}
            className="rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
