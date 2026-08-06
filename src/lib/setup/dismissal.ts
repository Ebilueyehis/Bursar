import type { SetupTaskId } from "@/lib/setup/setupTasks";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const VALID: SetupTaskId[] = ["staff", "vendors"];

export function dismissalKey(userId: string): string {
  return `bursar-setup-dismissed:${userId}`;
}

export function readDismissed(store: StorageLike, userId: string): SetupTaskId[] {
  try {
    const raw = store.getItem(dismissalKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is SetupTaskId => VALID.includes(x as SetupTaskId));
  } catch {
    return [];
  }
}

export function addDismissed(
  store: StorageLike,
  userId: string,
  id: SetupTaskId,
): SetupTaskId[] {
  const current = readDismissed(store, userId);
  if (current.includes(id)) return current;
  const next = [...current, id];
  store.setItem(dismissalKey(userId), JSON.stringify(next));
  return next;
}
