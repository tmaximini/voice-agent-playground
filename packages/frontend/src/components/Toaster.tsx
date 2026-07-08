import { useSyncExternalStore } from "react";
import { getToasts, subscribeToasts } from "../lib/toast";

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-4 py-2.5 text-sm text-emerald-200 shadow-lg backdrop-blur"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
