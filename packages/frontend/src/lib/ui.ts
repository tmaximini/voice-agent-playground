// Shared class strings so every panel, input and button reads as one system.

export const panelCls = "rounded-xl bg-panel border border-line";

export const inputCls =
  "w-full rounded-lg bg-canvas border border-line px-3 py-2 text-sm text-fg placeholder:text-faint outline-none transition-colors focus:border-faint disabled:opacity-50";

export const labelCls = "text-[13px] text-muted";

export const headingCls = "text-sm font-medium text-fg";

/** Primary action: solid ink. */
export const primaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-fg px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35";

/** Secondary action: quiet raised surface. */
export const secondaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-raised border border-line px-3 py-2 text-sm text-fg transition-colors hover:border-faint disabled:cursor-not-allowed disabled:opacity-40";

/** Destructive action: tinted, never solid. */
export const dangerBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-bad/10 border border-bad/40 px-4 py-2 text-sm font-medium text-bad transition-colors hover:bg-bad/15 active:scale-[0.98]";

/** Inline text action (Clear all, Delete…). */
export const ghostBtnCls =
  "rounded-md px-2 py-1 text-[13px] text-muted transition-colors hover:bg-raised hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent";

export function fmtMs(v?: number): string {
  return v == null ? "—" : Math.round(v).toLocaleString("en-US");
}
