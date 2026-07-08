// Minimal dependency-free toast store, consumed via useSyncExternalStore.

export interface Toast {
  id: number;
  message: string;
}

type Listener = () => void;

const DURATION_MS = 2500;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

export function toast(message: string): void {
  const id = nextId++;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, DURATION_MS);
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getToasts(): Toast[] {
  return toasts;
}
