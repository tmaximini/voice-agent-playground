import { useSessionUsage } from "../lib/metricsStore";
import { DEFAULT_PIPELINE } from "../data/providers";
import { estimateCost, fmtUsd } from "../lib/cost";

// Session-accumulated usage per provider with a rough cost estimate.
// Token/char counts come from the MetricEvent stream; STT is estimated from
// streamed-audio time (the mic streams continuously while live). Prices live
// in data/prices.ts — deliberately editable, plans differ.
export default function CostPanel() {
  const u = useSessionUsage();
  if (u.sessionMs === 0) return null;

  const cost = estimateCost(u, {
    sttProvider: DEFAULT_PIPELINE.stt.provider,
    llmModel: DEFAULT_PIPELINE.llm.model,
    ttsProvider: DEFAULT_PIPELINE.tts.provider,
  });

  const rows = [
    { stage: "stt", usage: `${(u.sessionMs / 60_000).toFixed(1)} min streamed`, cost: cost.stt },
    { stage: "llm", usage: `${u.llmTokensIn} in · ${u.llmTokensOut} out tok`, cost: cost.llm },
    { stage: "tts", usage: `${u.ttsChars} chars`, cost: cost.tts },
  ];

  return (
    <section className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          Session usage · est. cost
        </h2>
        <span className="font-mono text-sm font-medium tabular-nums text-neutral-200">
          {fmtUsd(cost.total)}
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
