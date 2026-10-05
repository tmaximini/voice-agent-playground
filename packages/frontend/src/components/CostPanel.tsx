import { useSessionUsage } from "../lib/metricsStore";
import { DEFAULT_PIPELINE } from "../data/providers";
import { estimateCost, fmtUsd } from "../lib/cost";
import { STAGES, type StageKey } from "../lib/stages";
import { headingCls, panelCls } from "../lib/ui";

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

  const rows: { stage: StageKey; label: string; usage: string; cost: number }[] = [
    { stage: "stt", label: "Transcription", usage: `${(u.sessionMs / 60_000).toFixed(1)} min`, cost: cost.stt },
    {
      stage: "llm",
      label: "LLM",
      usage: `${u.llmTokensIn.toLocaleString("en-US")} in, ${u.llmTokensOut.toLocaleString("en-US")} out`,
      cost: cost.llm,
    },
    { stage: "tts", label: "Speech", usage: `${u.ttsChars.toLocaleString("en-US")} chars`, cost: cost.tts },
  ];

  return (
    <section className={`${panelCls} p-5`}>
      <div className="flex items-baseline justify-between">
        <h2 className={headingCls}>Usage this session</h2>
        <span className="text-lg font-medium tabular-nums">{fmtUsd(cost.total)}</span>
      </div>
      <table className="mt-3 w-full text-[13px] tabular-nums">
        <tbody>
          {rows.map((r) => (
            <tr key={r.stage} className="border-t border-line first:border-t-0">
              <td className="py-2 text-muted">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={`h-2 w-2 rounded-sm ${STAGES[r.stage].bg}`} />
                  {r.label}
                </span>
              </td>
              <td className="py-2 text-right text-muted">{r.usage}</td>
              <td className="w-20 py-2 text-right">{fmtUsd(r.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-faint">
        Estimated from list prices in <code className="font-mono">data/prices.ts</code>. Edit them to match your plan.
      </p>
    </section>
  );
}
