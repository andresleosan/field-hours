export type Role = "admin" | "worker";
export type ShiftState = "off_shift" | "working" | "on_break" | "complete";
export type ShiftAction = "clock_in" | "start_break" | "end_break" | "clock_out";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  timezone: string;
  mustChangePassword: boolean;
}

export interface AuthContext {
  sessionHash: string;
  csrfHash: string;
  user: SessionUser;
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
  projectId: string | null;
  projectName?: string | null;
  events: ShiftEvent[];
}
