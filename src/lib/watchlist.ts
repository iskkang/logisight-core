const STORAGE_KEY = "logisight:watchlist";

export type WatchlistItem = {
  id: string; // e.g. "air:ICN:LAX" or "sea:KRPUS:CNSHA"
  mode: "air" | "sea" | "rail";
  origin: string;
  dest: string;
  label: string;
  addedAt: string; // ISO date
};

export interface WatchlistStore {
  getAll(): WatchlistItem[];
  add(item: Omit<WatchlistItem, "id" | "addedAt">): WatchlistItem;
  remove(id: string): void;
  has(id: string): boolean;
}

function makeId(item: Pick<WatchlistItem, "mode" | "origin" | "dest">): string {
  return `${item.mode}:${item.origin}:${item.dest}`;
}

function load(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: WatchlistItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage quota — ignore
  }
}

export function createLocalWatchlist(): WatchlistStore {
  return {
    getAll() {
      return load();
    },

    add(item) {
      const id = makeId(item);
      const items = load().filter((i) => i.id !== id);
      const newItem: WatchlistItem = { ...item, id, addedAt: new Date().toISOString().slice(0, 10) };
      save([...items, newItem]);
      return newItem;
    },

    remove(id) {
      save(load().filter((i) => i.id !== id));
    },

    has(id) {
      return load().some((i) => i.id === id);
    },
  };
}
