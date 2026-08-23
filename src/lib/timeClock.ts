import { backend, type SessionUser } from "./safeClient";

export type Role = "admin" | "worker";
export type ShiftState = "off_shift" | "working" | "on_break" | "complete";
export type ShiftAction = "clock_in" | "start_break" | "end_break" | "clock_out";

export interface GoogleAuthRequest {
  id: string;
  organizationId: string;
  requestType: "access" | "migration";
  email: string;
  displayName: string;
  existingUserId: string | null;
  requestedAt: string;
}

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
  photo?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
  is_active: boolean;
  created_at: string;
}

export interface ShiftSnapshot {
  id: string;
  state: ShiftState;
  clockInAt: string | null;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  clockOutAt: string | null;
  projectId?: string | null;
  projectName?: string | null;
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
  project_id?: string | null;
  project_name?: string | null;
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
  project_id?: string | null;
  project_name?: string | null;
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

export function startGoogleSignIn(mode: "signin" | "link" = "signin"): void {
  window.location.assign(`/api/auth/google/start?mode=${mode}`);
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
  projectId?: string,
  photo?: string,
): Promise<ShiftSnapshot> {
  return backend.post<ShiftSnapshot>("/api/shift/action", {
    action,
    location,
    idempotencyKey,
    projectId,
    photo,
  }, true);
}

export async function createInvitation(): Promise<{ token: string; expiresAt: string }> {
  return backend.post<{ token: string; expiresAt: string }>("/api/invitations", {}, true);
}

export async function loadGoogleAuthRequests(): Promise<GoogleAuthRequest[]> {
  return backend.get<GoogleAuthRequest[]>("/api/admin/auth-requests");
}

export async function reviewGoogleAuthRequest(
  requestId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<void> {
  await backend.post<{ ok: true }>(
    `/api/admin/auth-requests/${encodeURIComponent(requestId)}/${decision}`,
    reason ? { reason } : {},
    true,
  );
}

export async function loadProjects(): Promise<Project[]> {
  return backend.get<Project[]>("/api/projects");
}

export async function saveProject(input: {
  id?: string;
  name: string;
  code?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  isActive?: boolean;
}): Promise<Project> {
  return backend.post<Project>("/api/admin/projects", input, true);
}

export async function loadWorkerShift(): Promise<ShiftSnapshot> {
  return backend.get<ShiftSnapshot>("/api/worker/today");
}

export async function loadAdminToday(): Promise<AdminSnapshot[]> {
  return backend.get<AdminSnapshot[]>("/api/admin/today");
}

export async function loadAdminHistory(params?: {
  userId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ShiftHistoryRecord[]> {
  const query = new URLSearchParams();
  if (params?.userId && params.userId !== "all") query.set("user_id", params.userId);
  if (params?.projectId && params.projectId !== "all") query.set("project_id", params.projectId);
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

export async function adjustShift(input: {
  shiftId: string;
  clockInAt?: string;
  clockOutAt?: string;
  reason: string;
}): Promise<{ ok: true; shiftId: string }> {
  return backend.post<{ ok: true; shiftId: string }>("/api/admin/shifts/adjust", input, true);
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatRecordedTime(
  value: string | Date | null | undefined,
  timezone: string,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

export function formatRecordedDateTime(
  value: string | Date | null | undefined,
  timezone: string,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
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
