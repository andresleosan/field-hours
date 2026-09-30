import { ApiClientError } from "./safeClient";
import { runShiftAction, type LocationEvidence, type ShiftAction, type ShiftSnapshot } from "./timeClock";

export interface QueuedAction {
  id: string;
  action: ShiftAction;
  location: LocationEvidence;
  idempotencyKey: string;
  projectId?: string;
  queuedAt: string;
}

const STORAGE_KEY = "fh_offline_action_queue";

export function getOfflineQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineAction(
  action: ShiftAction,
  location: LocationEvidence,
  idempotencyKey: string,
  projectId?: string,
): QueuedAction {
  const item: QueuedAction = {
    id: crypto.randomUUID(),
    action,
    location,
    idempotencyKey,
    projectId,
    queuedAt: new Date().toISOString(),
  };
  const current = getOfflineQueue();
  current.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  return item;
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function syncOfflineQueue(
  onSynced?: (snapshot: ShiftSnapshot) => void,
): Promise<{ syncedCount: number; rejected: string[]; lastSnapshot?: ShiftSnapshot }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, rejected: [] };

  let lastSnapshot: ShiftSnapshot | undefined;
  let syncedCount = 0;
  let processed = 0;
  const rejected: string[] = [];

  for (const item of queue) {
    try {
      lastSnapshot = await runShiftAction(item.action, item.location, item.idempotencyKey, item.projectId);
      syncedCount++;
      processed++;
      if (onSynced && lastSnapshot) onSynced(lastSnapshot);
    } catch (error) {
      // The server refused this action for good (e.g. the shift was adjusted meanwhile):
      // drop it and report it instead of retrying it forever and blocking the rest.
      if (error instanceof ApiClientError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        rejected.push(error.message);
        processed++;
        continue;
      }
      // Do not expose queued GPS evidence in browser logs.
      console.warn("Failed to sync an offline shift action.", error);
      break;
    }
  }

  // Remove synced and rejected items from queue
  if (processed > 0) {
    const remaining = queue.slice(processed);
    if (remaining.length === 0) {
      clearOfflineQueue();
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    }
  }

  return { syncedCount, rejected, lastSnapshot };
}
