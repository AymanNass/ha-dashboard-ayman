import { defaultPantryItems } from '../config';

/**
 * Shopping / pantry list shared across devices via the add-on server
 * (`/shopping` → /data/shopping.json), mirroring the layout/settings pattern.
 *
 * Two kinds of item live in one list:
 *   • `fixed: true`  — pantry staples (latte, pane…) that are always listed and
 *     just get checked (have it) / unchecked (missing). Seeded from
 *     `defaultPantryItems` on first run.
 *   • `fixed: false` — ad-hoc items added for a specific shop; these can be
 *     removed entirely.
 *
 * `have === false` means "manca" (to buy). The checkbox toggles `have`.
 */
export interface ShoppingItem {
  id: string;
  text: string;
  have: boolean;
  fixed: boolean;
  /** Creation time, used to keep a stable order for ad-hoc items. */
  ts: number;
}

export interface ShoppingList {
  items: ShoppingItem[];
}

// Resolve the endpoint relative to the app's base path so it works behind HA
// Ingress (served under /api/hassio_ingress/<token>/) as well as at the root —
// same approach as the connection/settings endpoints in settings.ts.
const SHOPPING_ENDPOINT = `${import.meta.env.BASE_URL}shopping`.replace(/\/\/+/g, '/');

let idSeq = 0;
/** Short, collision-resistant id for a list item. */
function newId(): string {
  idSeq += 1;
  return `${Date.now().toString(36)}-${idSeq.toString(36)}`;
}

/** The seed list used on first run (no server copy yet): the fixed pantry. */
export function seedList(): ShoppingList {
  return {
    items: defaultPantryItems.map((text) => ({
      id: newId(),
      text,
      have: false,
      fixed: true,
      ts: Date.now(),
    })),
  };
}

/** Normalize an unknown server payload into a valid ShoppingList. */
function coerce(data: unknown): ShoppingList {
  if (!data || typeof data !== 'object' || !Array.isArray((data as ShoppingList).items)) {
    return { items: [] };
  }
  const items = (data as ShoppingList).items
    .filter((it) => it && typeof it.text === 'string' && it.text.trim())
    .map((it) => ({
      id: typeof it.id === 'string' && it.id ? it.id : newId(),
      text: it.text.trim(),
      have: !!it.have,
      fixed: !!it.fixed,
      ts: typeof it.ts === 'number' ? it.ts : Date.now(),
    }));
  return { items };
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 4000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load the list from the server. On first run (204 / empty) seed the fixed
 * pantry and persist it so the next load is stable. Returns a usable list even
 * if the server is unreachable (falls back to the in-memory seed).
 */
export async function loadShopping(): Promise<ShoppingList> {
  try {
    const res = await fetchWithTimeout(SHOPPING_ENDPOINT);
    if (res.status === 204 || !res.ok) {
      const seeded = seedList();
      void saveShopping(seeded);
      return seeded;
    }
    const list = coerce(await res.json());
    // Empty stored list (e.g. after a DELETE) → reseed the pantry.
    if (list.items.length === 0) {
      const seeded = seedList();
      void saveShopping(seeded);
      return seeded;
    }
    return list;
  } catch {
    return seedList();
  }
}

/** Persist the whole list. Fire-and-forget at call sites; errors are swallowed. */
export async function saveShopping(list: ShoppingList): Promise<void> {
  try {
    await fetchWithTimeout(SHOPPING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    });
  } catch {
    /* offline / server down — the UI keeps the local copy */
  }
}

// ── Pure list operations (return a new list; caller persists + sets state) ──

export function toggleItem(list: ShoppingList, id: string): ShoppingList {
  return { items: list.items.map((it) => (it.id === id ? { ...it, have: !it.have } : it)) };
}

export function addItem(list: ShoppingList, text: string, fixed = false): ShoppingList {
  const clean = text.trim();
  if (!clean) return list;
  // Avoid duplicates (case-insensitive) — just unmark "have" if it already exists.
  const existing = list.items.find((it) => it.text.toLowerCase() === clean.toLowerCase());
  if (existing) {
    return { items: list.items.map((it) => (it.id === existing.id ? { ...it, have: false } : it)) };
  }
  return {
    items: [...list.items, { id: newId(), text: clean, have: false, fixed, ts: Date.now() }],
  };
}

export function removeItem(list: ShoppingList, id: string): ShoppingList {
  return { items: list.items.filter((it) => it.id !== id) };
}

export function renameItem(list: ShoppingList, id: string, text: string): ShoppingList {
  const clean = text.trim();
  if (!clean) return list;
  return { items: list.items.map((it) => (it.id === id ? { ...it, text: clean } : it)) };
}

/** Uncheck everything (e.g. "start a new shop"). */
export function resetHave(list: ShoppingList): ShoppingList {
  return { items: list.items.map((it) => ({ ...it, have: false })) };
}
