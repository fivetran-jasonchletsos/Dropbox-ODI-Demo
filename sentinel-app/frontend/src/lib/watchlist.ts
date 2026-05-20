const KEY = 'sentinel.watchlist';

type Listener = (ids: string[]) => void;
const listeners = new Set<Listener>();

export function get(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function emit() {
  const ids = get();
  listeners.forEach((l) => l(ids));
}

export function add(id: string) {
  const ids = new Set(get());
  ids.add(id);
  localStorage.setItem(KEY, JSON.stringify([...ids]));
  emit();
}

export function remove(id: string) {
  const ids = get().filter((x) => x !== id);
  localStorage.setItem(KEY, JSON.stringify(ids));
  emit();
}

export function toggle(id: string) {
  const ids = get();
  if (ids.includes(id)) remove(id);
  else add(id);
}

export function has(id: string): boolean {
  return get().includes(id);
}

export function clear() {
  localStorage.setItem(KEY, JSON.stringify([]));
  emit();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
