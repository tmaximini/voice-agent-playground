import { useSyncExternalStore } from "react";
import { getToasts, subscribeToasts } from "../lib/toast";

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-canvas shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
