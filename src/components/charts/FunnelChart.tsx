"use client";

import { fmtInt, fmtRate } from "@/lib/format";
import type { EcommerceFunnel } from "@/lib/types";

/**
 * Item-scoped ecommerce funnel: view → cart → checkout → purchase. Every stage
 * counts items, so each bar is drawn relative to the first stage and labelled
 * with the drop-off from the stage immediately before it — that step-to-step
 * rate is what shows where sales are lost.
 */
export function FunnelChart({ funnel }: { funnel: EcommerceFunnel }) {
  const stages = [
    { label: "Viewed", value: funnel.itemsViewed },
    { label: "Added to cart", value: funnel.itemsAddedToCart },
    { label: "Checked out", value: funnel.itemsCheckedOut },
    { label: "Purchased", value: funnel.itemsPurchased },
  ];
  const top = stages[0].value;

  // The step with the steepest fall is the biggest opportunity; highlight it.
  const drops = stages.map((s, i) => {
    const prev = i === 0 ? 0 : stages[i - 1].value;
    return i === 0 || prev === 0 ? 0 : (prev - s.value) / prev;
  });
  const worst = drops.indexOf(Math.max(...drops.slice(1)));

  return (
    <div className="space-y-3 p-5">
      {stages.map((s, i) => {
        const width = top > 0 ? s.value / top : 0;
        const stepRate = i > 0 && stages[i - 1].value > 0 ? s.value / stages[i - 1].value : null;
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="tabular">
                <span className="font-semibold">{fmtInt(s.value)}</span>
                {stepRate !== null ? (
                  <span className="ml-2 text-xs text-muted">{fmtRate(stepRate)} of previous</span>
                ) : null}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-paper">
              <div
                className={`h-full rounded-full ${i === worst ? "bg-negative" : "bg-accent"}`}
                style={{ width: `${Math.max(1.5, width * 100)}%` }}
              />
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-xs">
        <span className="text-muted">
          View → purchase:{" "}
          <span className="tabular font-semibold text-ink">
            {top > 0 ? fmtRate(funnel.itemsPurchased / top) : "–"}
          </span>
        </span>
        {worst > 0 && drops[worst] > 0 ? (
          <span className="text-negative">
            Biggest drop-off at {stages[worst].label.toLowerCase()} ({fmtRate(drops[worst])} lost)
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Counts items, not sessions — an order of three urns counts as three.
      </p>
    </div>
  );
}
