import { useSessionUsage } from "../lib/metricsStore";
import { DEFAULT_PIPELINE } from "../data/providers";
import { LLM_PER_MTOK, STT_PER_MIN, TTS_PER_CHAR } from "../data/prices";

function fmtUsd(v: number): string {
  return v < 0.01 && v > 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

// Session-accumulated usage per provider with a rough cost estimate.
// Token/char counts come from the MetricEvent stream; STT is estimated from
// streamed-audio time (the mic streams continuously while live). Prices live
// in data/prices.ts — deliberately editable, plans differ.
export default function CostPanel() {
  const u = useSessionUsage();
  if (u.sessionMs === 0) return null;

  const sttMin = u.sessionMs / 60_000;
  const llmPrice = LLM_PER_MTOK[DEFAULT_PIPELINE.llm.model];
  const sttCost = sttMin * (STT_PER_MIN[DEFAULT_PIPELINE.stt.provider] ?? 0);
  const llmCost = llmPrice
    ? (u.llmTokensIn / 1e6) * llmPrice.in + (u.llmTokensOut / 1e6) * llmPrice.out
    : 0;
  const ttsCost = u.ttsChars * (TTS_PER_CHAR[DEFAULT_PIPELINE.tts.provider] ?? 0);

  const rows = [
    { stage: "stt", usage: `${sttMin.toFixed(1)} min streamed`, cost: sttCost },
    { stage: "llm", usage: `${u.llmTokensIn} in · ${u.llmTokensOut} out tok`, cost: llmCost },
    { stage: "tts", usage: `${u.ttsChars} chars`, cost: ttsCost },
  ];

  return (
    <section className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          Session usage · est. cost
        </h2>
        <span className="font-mono text-sm font-medium tabular-nums text-neutral-200">
          {fmtUsd(sttCost + llmCost + ttsCost)}
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.stage}
            className="flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums"
          >
            <span className="uppercase tracking-widest text-neutral-600">{r.stage}</span>
            <span className="flex-1 text-right text-neutral-400">{r.usage}</span>
            <span className="w-16 text-right text-neutral-300">{fmtUsd(r.cost)}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-neutral-600">
        Estimates from list prices in <code>data/prices.ts</code> — edit for your plan.
      </p>
    </section>
  );
}
