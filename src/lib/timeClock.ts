import { backend, type SessionUser } from "./safeClient";

export type Role = "admin" | "worker";
export type ShiftState = "off_shift" | "working" | "on_break" | "complete";
export type ShiftAction = "clock_in" | "start_break" | "end_break" | "clock_out";

export interface LocationEvidence {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface ShiftEvent {
  id: string;
  type: ShiftAction;
  at: string;
  location: LocationEvidence;
}

export interface ShiftSnapshot {
  id: string;
  state: ShiftState;
  clockInAt: string | null;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  clockOutAt: string | null;
  events: ShiftEvent[];
}

export interface AdminSnapshot {
  user_id: string;
  display_name: string;
  role: Role;
  state: ShiftState;
  clock_in_at: string | null;
  break_started_at: string | null;
  break_ended_at: string | null;
  clock_out_at: string | null;
  events: ShiftEvent[];
}

export interface ShiftHistoryRecord {
  id: string;
  user_id: string;
  display_name: string;
  work_date: string;
  state: ShiftState;
  clock_in_at: string;
  break_started_at: string | null;
  break_ended_at: string | null;
  clock_out_at: string | null;
  duration_minutes: number;
  break_minutes: number;
  net_minutes: number;
  events: ShiftEvent[];
}

const transition: Record<ShiftState, Partial<Record<ShiftAction, ShiftState>>> = {
  off_shift: { clock_in: "working" },
  working: { start_break: "on_break", clock_out: "complete" },
  on_break: { end_break: "working" },
  complete: {},
};

export function nextState(state: ShiftState, action: ShiftAction): ShiftState | null {
  return transition[state][action] ?? null;
}

export function requestLocation(): Promise<LocationEvidence> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location is not available on this device."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: Number(coords.latitude.toFixed(7)),
        longitude: Number(coords.longitude.toFixed(7)),
        accuracy: Math.round(coords.accuracy),
      }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED
        ? "Location permission is needed to record this action."
        : "We could not get a fresh location. Try again.")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  });
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const result = await backend.post<{ user: SessionUser }>("/api/auth/login", { email, password });
  return result.user;
}

export async function registerWorker(input: {
  invitationToken: string;
  email: string;
  password: string;
  displayName: string;
  phone?: string;
}): Promise<SessionUser> {
  const result = await backend.post<{ user: SessionUser }>("/api/auth/register", input);
  return result.user;
}

export async function loadSession(): Promise<SessionUser> {
  const result = await backend.get<{ user: SessionUser }>("/api/session");
  return result.user;
}

export async function signOut(): Promise<void> {
  await backend.post<{ ok: true }>("/api/auth/logout", {}, true);
}

export async function changePassword(password: string): Promise<SessionUser> {
  const result = await backend.post<{ user: SessionUser }>("/api/auth/password", { password }, true);
  return result.user;
}

export async function runShiftAction(
  action: ShiftAction,
  location: LocationEvidence,
  idempotencyKey: string,
): Promise<ShiftSnapshot> {
  return backend.post<ShiftSnapshot>("/api/shift/action", {
    action,
    location,
    idempotencyKey,
  }, true);
}

export async function createInvitation(): Promise<{ token: string; expiresAt: string }> {
  return backend.post<{ token: string; expiresAt: string }>("/api/invitations", {}, true);
}

export async function loadWorkerShift(): Promise<ShiftSnapshot> {
  return backend.get<ShiftSnapshot>("/api/worker/today");
}

export async function loadAdminToday(): Promise<AdminSnapshot[]> {
  return backend.get<AdminSnapshot[]>("/api/admin/today");
}

export async function loadAdminHistory(params?: {
  userId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ShiftHistoryRecord[]> {
  const query = new URLSearchParams();
  if (params?.userId && params.userId !== "all") query.set("user_id", params.userId);
  if (params?.startDate) query.set("start_date", params.startDate);
  if (params?.endDate) query.set("end_date", params.endDate);
  const qStr = query.toString();
  return backend.get<ShiftHistoryRecord[]>(`/api/admin/shifts/history${qStr ? `?${qStr}` : ""}`);
}

export async function loadWorkerHistory(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ShiftHistoryRecord[]> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("start_date", params.startDate);
  if (params?.endDate) query.set("end_date", params.endDate);
  const qStr = query.toString();
  return backend.get<ShiftHistoryRecord[]>(`/api/worker/shifts/history${qStr ? `?${qStr}` : ""}`);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatWorkedDuration(
  events: ShiftEvent[],
  state: ShiftState,
  now = Date.now(),
): string {
  let activeSince: number | null = null;
  let milliseconds = 0;
  for (const event of events) {
    const occurredAt = new Date(event.at).getTime();
    if (!Number.isFinite(occurredAt)) continue;
    if (event.type === "clock_in" || event.type === "end_break") {
      activeSince = occurredAt;
    } else if ((event.type === "start_break" || event.type === "clock_out") && activeSince !== null) {
      milliseconds += Math.max(0, occurredAt - activeSince);
      activeSince = null;
    }
  }
  if (state === "working" && activeSince !== null) {
    milliseconds += Math.max(0, now - activeSince);
  }
  const minutes = Math.floor(milliseconds / 60_000);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function actionLabel(action: ShiftAction): string {
  return ({
    clock_in: "Clock in",
    start_break: "Start break",
    end_break: "End break",
    clock_out: "Finish shift",
  })[action];
}
