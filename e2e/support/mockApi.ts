import { expect, type BrowserContext, type Route } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:4187";
const CSRF_TOKEN = "synthetic-e2e-csrf-token";
const NOW = "2026-08-25T09:00:00.000Z";

type Role = "admin" | "worker";
type ShiftAction = "clock_in" | "start_break" | "end_break" | "clock_out";
type ShiftState = "off_shift" | "working" | "on_break" | "complete";

interface ShiftEvent {
  id: string;
  type: ShiftAction;
  at: string;
  location: { latitude: number; longitude: number; accuracy: number };
}

interface ShiftSnapshot {
  id: string;
  state: ShiftState;
  clockInAt: string | null;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  clockOutAt: string | null;
  projectId: string | null;
  projectName: string | null;
  events: ShiftEvent[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
  is_active: boolean;
  created_at: string;
}

export interface ApiCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockApiControl {
  calls: ApiCall[];
  externalRequests: string[];
}

export interface WorkerMockControl extends MockApiControl {
  completedShiftCount: () => number;
}

function sessionUser(role: Role) {
  return {
    id: `${role}-1`,
    email: `${role}@field-hours.test`,
    displayName: role === "admin" ? "Admin Test" : "Worker Test",
    role,
    organizationId: "org-1",
    organizationName: "Field Hours Test",
    timezone: "Europe/Jersey",
    mustChangePassword: false,
  };
}

function json(route: Route, value: unknown, status = 200) {
  return route.fulfill({ status, json: value });
}

function bodyOf(route: Route): unknown {
  const raw = route.request().postData();
  return raw ? JSON.parse(raw) : undefined;
}

function emptyShift(): ShiftSnapshot {
  return {
    id: "new-shift",
    state: "off_shift",
    clockInAt: null,
    breakStartedAt: null,
    breakEndedAt: null,
    clockOutAt: null,
    projectId: null,
    projectName: null,
    events: [],
  };
}

async function prepareContext(
  context: BrowserContext,
  handler: (route: Route, path: string, method: string, body: unknown) => Promise<void>,
): Promise<MockApiControl> {
  const calls: ApiCall[] = [];
  const externalRequests: string[] = [];

  await context.addCookies([{ name: "fh_csrf", value: CSRF_TOKEN, url: APP_ORIGIN }]);
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("fh_lang", "en");
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== APP_ORIGIN) {
      externalRequests.push(request.url());
      await route.abort("blockedbyclient");
      return;
    }
    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }

    const body = bodyOf(route);
    calls.push({
      method: request.method(),
      path: `${url.pathname}${url.search}`,
      headers: request.headers(),
      body,
    });
    await handler(route, url.pathname, request.method(), body);
  });

  return { calls, externalRequests };
}

function assertCsrf(route: Route): boolean {
  return route.request().headers()["x-csrf-token"] === CSRF_TOKEN;
}

export async function installAdminApi(
  context: BrowserContext,
  options: { payrollPreviewError?: boolean } = {},
): Promise<MockApiControl> {
  const adminPeople = [{
    user_id: "worker-1",
    display_name: "Worker Test",
    role: "worker",
    state: "off_shift",
    clock_in_at: null,
    break_started_at: null,
    break_ended_at: null,
    clock_out_at: null,
    project_id: null,
    project_name: null,
    events: [],
  }];
  const adminProjects: Project[] = [{
    id: "project-1",
    name: "Existing Site",
    description: "Existing test project",
    code: "SITE-1",
    address: "1 Existing Road",
    latitude: null,
    longitude: null,
    radius_m: 200,
    is_active: true,
    created_at: NOW,
  }];
  let adminHistory: Array<Record<string, unknown>> = [];
  const totals = {
    grossPay: 2400,
    workerSocialSecurity: 144,
    incomeTax: 240,
    netPay: 2016,
    employerSocialSecurity: 156,
    employerTotalCost: 2556,
  };
  const preview = {
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    payDate: "2026-09-01",
    currency: "GBP",
    isEstimate: true,
    rules: {
      year: 2026,
      minimumEarningsThreshold: 0,
      standardEarningsLimit: 5000,
      upperEarningsLimit: 10000,
      workerSocialSecurityRate: 6,
      employerSocialSecurityRate: 6.5,
      employerUpperBandRate: 2.5,
      defaultItisRate: 10,
    },
    lines: [{
      userId: "worker-1",
      displayName: "Worker Test",
      email: "worker@field-hours.test",
      employeeNumber: "EMP-001",
      profileStatus: "approved",
      shiftCount: 12,
      hours: 120,
      itisRate: 10,
      grossPay: 2400,
      workerSocialSecurity: 144,
      incomeTax: 240,
      netPay: 2016,
      employerSocialSecurity: 156,
      employerTotalCost: 2556,
      warnings: [],
    }],
    totals,
  };
  const snapshotLine = {
    userId: "worker-1",
    displayName: "Worker Test",
    employeeNumber: "EMP-001",
    profileStatus: "approved",
    shiftCount: 12,
    netMinutes: 7200,
    itisRate: 10,
    grossPay: 2400,
    workerSocialSecurity: 144,
    incomeTax: 240,
    netPay: 2016,
    employerSocialSecurity: 156,
    employerTotalCost: 2556,
    warnings: [],
  };
  const profile = {
    userId: "worker-1",
    displayName: "Worker Test",
    email: "worker@field-hours.test",
    legalName: "Worker Test",
    address: "1 Test Street",
    employeeNumber: "EMP-001",
    maskedSocialSecurityNumber: "***1234",
    maskedTaxReference: "***5678",
    maskedSocialReference: "***9012",
    maskedBankAccountNumber: "***3456",
    itisRate: 10,
    status: "approved",
    submittedAt: NOW,
    reviewedAt: NOW,
    reviewNote: null,
  };
  const settings = {
    hourlyRate: 20,
    payFrequency: "monthly",
    payDay: 1,
    businessName: "Field Hours Test",
    businessAddress: "1 Test Street",
    hasBusinessTaxReference: true,
    hasBusinessSocialReference: true,
    workerSocialSecurityRate: 6,
    employerSocialSecurityRate: 6.5,
    updatedAt: NOW,
  };
  let runs: Array<Record<string, unknown>> = [];

  return prepareContext(context, async (route, path, method, body) => {
    if (method === "GET" && path === "/api/session") return json(route, { user: sessionUser("admin") });
    if (method === "GET" && path === "/api/admin/today") return json(route, adminPeople);
    if (method === "GET" && path === "/api/projects") return json(route, adminProjects);
    if (method === "GET" && path === "/api/admin/shifts/history") return json(route, adminHistory);
    if (method === "GET" && path === "/api/admin/auth-requests") return json(route, []);
    if (method === "GET" && path === "/api/admin/password-reset-requests") return json(route, []);
    if (method === "GET" && path === "/api/admin/request-history") return json(route, []);
    if (method === "GET" && path === "/api/admin/payroll-profiles") return json(route, [profile]);
    if (method === "GET" && path === "/api/admin/payroll-settings") return json(route, settings);
    if (method === "GET" && path === "/api/admin/payroll-preview") {
      return options.payrollPreviewError
        ? json(route, { error: "Configure payroll settings before calculating payroll.", code: "PAYROLL_SETTINGS_REQUIRED" }, 409)
        : json(route, preview);
    }
    if (method === "GET" && path === "/api/admin/payroll-runs") return json(route, runs);
    if (method === "GET" && path === "/api/admin/payroll-runs/payroll-run-1") {
      if (!runs[0]) return json(route, { error: "Payroll run not found", code: "NOT_FOUND" }, 404);
      return json(route, { ...runs[0], lines: [snapshotLine] });
    }

    if (method === "POST" && path === "/api/admin/payroll-runs") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      if (JSON.stringify(body) !== "{}") return json(route, { error: "Unexpected contract", code: "INVALID_INPUT" }, 400);
      const run = {
        id: "payroll-run-1",
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        payDate: preview.payDate,
        currency: "GBP",
        status: "pending_review",
        submittedAt: NOW,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        totals,
        workerCount: 1,
      };
      runs = [run];
      return json(route, run);
    }

    if (method === "POST" && path === "/api/admin/shifts/create") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const input = body as {
        userId?: unknown;
        projectId?: unknown;
        clockInAt?: unknown;
        clockOutAt?: unknown;
        description?: unknown;
      };
      if (
        input?.userId !== "worker-1"
        || (input.projectId !== undefined && input.projectId !== "project-1")
        || typeof input.clockInAt !== "string"
        || typeof input.clockOutAt !== "string"
        || typeof input.description !== "string"
        || input.description.trim().length < 3
        || Date.parse(input.clockOutAt) <= Date.parse(input.clockInAt)
      ) {
        return json(route, { error: "Workday data is invalid", code: "INVALID_INPUT" }, 400);
      }
      const shiftId = "admin-created-shift-1";
      adminHistory = [{
        id: shiftId,
        user_id: "worker-1",
        display_name: "Worker Test",
        work_date: input.clockInAt.slice(0, 10),
        state: "complete",
        clock_in_at: input.clockInAt,
        break_started_at: null,
        break_ended_at: null,
        clock_out_at: input.clockOutAt,
        project_id: input.projectId ?? null,
        project_name: input.projectId === "project-1" ? "Existing Site" : null,
        duration_minutes: Math.round((Date.parse(input.clockOutAt) - Date.parse(input.clockInAt)) / 60_000),
        break_minutes: 0,
        net_minutes: Math.round((Date.parse(input.clockOutAt) - Date.parse(input.clockInAt)) / 60_000),
        events: [],
        admin_adjustment: {
          kind: "created",
          reason: input.description.trim(),
          adjusted_at: NOW,
        },
      }];
      return json(route, { ok: true, shiftId });
    }

    if (method === "POST" && path === "/api/admin/payroll-runs/payroll-run-1/review") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const decision = (body as { decision?: unknown } | undefined)?.decision;
      if (decision !== "approved" && decision !== "changes_requested") {
        return json(route, { error: "Unexpected contract", code: "INVALID_INPUT" }, 400);
      }
      runs = [{
        ...runs[0],
        status: decision,
        reviewedAt: "2026-08-25T09:05:00.000Z",
        reviewedBy: "admin-1",
        reviewNote: decision === "changes_requested"
          ? "Review the payroll details and resubmit the corrected period."
          : null,
      }];
      return json(route, runs[0]);
    }

    if (method === "POST" && path === "/api/admin/payroll-runs/payroll-run-1/payslips/worker-1") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      if (JSON.stringify(body) !== "{}") return json(route, { error: "Unexpected contract", code: "INVALID_INPUT" }, 400);
      if (runs[0]?.status !== "approved") {
        return json(route, { error: "Only approved runs can generate a Salary Advice", code: "PAYROLL_RUN_NOT_APPROVED" }, 409);
      }
      return json(route, {
        generatedAt: "2026-08-25T09:06:00.000Z",
        currency: "GBP",
        run: {
          id: "payroll-run-1",
          periodStart: preview.periodStart,
          periodEnd: preview.periodEnd,
          payDate: preview.payDate,
          submittedAt: NOW,
          approvedAt: "2026-08-25T09:05:00.000Z",
        },
        employer: { name: "Field Hours <Test>", address: "1 Test Street" },
        worker: {
          userId: "worker-1",
          displayName: "Worker Test",
          legalName: "Worker <Test>",
          address: "1 Worker Road",
          employeeNumber: "EMP-001",
          taxReference: "TAX-<123>",
          socialReference: "SOC-9012",
        },
        allowances: [{
          code: "basic_pay",
          description: "Basic pay <approved>",
          shiftCount: 12,
          netMinutes: 7200,
          hours: 120,
          amount: 2400,
        }],
        deductions: { workerSocialSecurity: 144, incomeTax: 240, total: 384 },
        grossTaxablePay: 2400,
        netPay: 2016,
        itisRate: 10,
      });
    }

    return json(route, { error: `Unhandled test route: ${method} ${path}`, code: "TEST_ROUTE_MISSING" }, 501);
  });
}

export async function installWorkerApi(
  context: BrowserContext,
  options: {
    adminCreatedHistory?: boolean;
    adjustedHistory?: boolean;
    failFirstClockOutNetwork?: boolean;
    overnightOpenShift?: boolean;
  } = {},
): Promise<WorkerMockControl> {
  let projects: Project[] = [{
    id: "project-1",
    name: "Existing Site",
    description: "Existing test project",
    code: "SITE-1",
    address: "1 Existing Road",
    latitude: null,
    longitude: null,
    radius_m: 200,
    is_active: true,
    created_at: NOW,
  }];
  let currentShift: ShiftSnapshot | null = options.overnightOpenShift
    ? {
      id: "overnight-shift-1",
      state: "working",
      clockInAt: "2026-08-24T08:00:00.000Z",
      breakStartedAt: null,
      breakEndedAt: null,
      clockOutAt: null,
      projectId: "project-1",
      projectName: "Existing Site",
      events: [{
        id: "overnight-clock-in",
        type: "clock_in",
        at: "2026-08-24T08:00:00.000Z",
        location: { latitude: 51.5074, longitude: -0.1278, accuracy: 12 },
      }],
    }
    : null;
  let activeWorkDate = options.overnightOpenShift ? "2026-08-24" : "2026-08-25";
  const completed: Array<Record<string, unknown>> = options.adjustedHistory || options.adminCreatedHistory
    ? [{
      id: options.adminCreatedHistory ? "admin-created-shift-1" : "adjusted-shift-1",
      user_id: "worker-1",
      display_name: "Worker Test",
      work_date: "2026-08-24",
      state: "complete",
      clock_in_at: "2026-08-24T08:00:00.000Z",
      break_started_at: null,
      break_ended_at: null,
      clock_out_at: "2026-08-24T16:00:00.000Z",
      project_id: "project-1",
      project_name: "Existing Site",
      duration_minutes: 480,
      break_minutes: 0,
      net_minutes: 480,
      events: [],
      admin_adjustment: {
        kind: options.adminCreatedHistory ? "created" : "adjusted",
        reason: options.adminCreatedHistory
          ? "Approved paper timesheet for site work."
          : "Worker forgot to clock out at the end of the shift.",
        adjusted_at: "2026-08-25T09:00:00.000Z",
      },
    }]
    : [];
  let shiftSequence = 0;
  let eventSequence = currentShift?.events.length ?? 0;
  let failedClockOutOnce = false;
  const eventOffsetsInMinutes = [0, 15, 25, 40, 65, 90, 120, 150];

  const control = await prepareContext(context, async (route, path, method, body) => {
    if (method === "GET" && path === "/api/session") return json(route, { user: sessionUser("worker") });
    if (method === "GET" && path === "/api/worker/today") return json(route, currentShift ?? emptyShift());
    if (method === "GET" && path === "/api/projects") return json(route, projects);
    if (method === "GET" && path === "/api/worker/shifts/history") return json(route, completed);
    if (method === "GET" && path === "/api/worker/payroll-profile") return json(route, { profile: null });
    if (method === "GET" && path === "/api/worker/payroll-summary") {
      const completedMinutes = completed.reduce((total, shift) => total + Number(shift.net_minutes ?? 0), 0);
      return json(route, {
        timezone: "Europe/Jersey",
        asOfDate: "2026-08-25",
        currentPeriodStart: "2026-08-01",
        currentPeriodMinutes: completedMinutes,
        currentPeriodShifts: completed.length,
        totalCompletedMinutes: completedMinutes,
        totalCompletedShifts: completed.length,
        lastPayDate: "2026-08-01",
        nextPayDate: "2026-09-01",
      });
    }

    if (method === "POST" && path === "/api/worker/projects") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const input = body as { name?: unknown; description?: unknown };
      if (typeof input?.name !== "string" || input.name.trim().length < 2 || typeof input.description !== "string" || !input.description.trim()) {
        return json(route, { error: "Project data is invalid", code: "INVALID_INPUT" }, 400);
      }
      const created: Project = {
        id: "project-worker-1",
        name: input.name.trim(),
        description: input.description.trim(),
        code: null,
        address: null,
        latitude: null,
        longitude: null,
        radius_m: 200,
        is_active: true,
        created_at: NOW,
      };
      projects = [...projects, created];
      return json(route, created);
    }

    if (method === "POST" && path === "/api/shift/action") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const input = body as {
        action?: ShiftAction;
        location?: { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
        idempotencyKey?: unknown;
        projectId?: unknown;
        photo?: unknown;
      };
      if (options.failFirstClockOutNetwork && input.action === "clock_out" && !failedClockOutOnce) {
        failedClockOutOnce = true;
        await route.abort("failed");
        return;
      }
      if ("photo" in input) return json(route, { error: "Photo is outside the current contract", code: "INVALID_INPUT" }, 400);
      if (!input.location || typeof input.location.latitude !== "number" || typeof input.location.longitude !== "number" || typeof input.location.accuracy !== "number") {
        return json(route, { error: "Fresh GPS is required", code: "INVALID_LOCATION" }, 400);
      }
      if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 16) {
        return json(route, { error: "Idempotency key is invalid", code: "INVALID_INPUT" }, 400);
      }

      const action = input.action;
      const allowed = currentShift?.state === "working"
        ? ["start_break", "clock_out"]
        : currentShift?.state === "on_break"
          ? ["end_break"]
          : ["clock_in"];
      if (!action || !allowed.includes(action)) {
        return json(route, { error: "Invalid shift transition", code: "INVALID_TRANSITION" }, 409);
      }

      const offset = eventOffsetsInMinutes[eventSequence] ?? eventSequence * 15;
      const at = new Date(Date.parse(NOW) + offset * 60_000).toISOString();
      eventSequence += 1;
      const event: ShiftEvent = {
        id: `event-${eventSequence}`,
        type: action,
        at,
        location: {
          latitude: input.location.latitude as number,
          longitude: input.location.longitude as number,
          accuracy: input.location.accuracy as number,
        },
      };

      if (action === "clock_in") {
        if (typeof input.projectId !== "string" || !projects.some((project) => project.id === input.projectId)) {
          return json(route, { error: "Select a project", code: "PROJECT_REQUIRED" }, 400);
        }
        shiftSequence += 1;
        activeWorkDate = "2026-08-25";
        const project = projects.find((item) => item.id === input.projectId)!;
        currentShift = {
          id: `shift-${shiftSequence}`,
          state: "working",
          clockInAt: at,
          breakStartedAt: null,
          breakEndedAt: null,
          clockOutAt: null,
          projectId: project.id,
          projectName: project.name,
          events: [event],
        };
        return json(route, currentShift);
      }

      const activeShift = currentShift!;
      const updated: ShiftSnapshot = {
        ...activeShift,
        state: action === "start_break" ? "on_break" : action === "end_break" ? "working" : "complete",
        breakStartedAt: action === "start_break" ? at : activeShift.breakStartedAt,
        breakEndedAt: action === "start_break" ? null : action === "end_break" ? at : activeShift.breakEndedAt,
        clockOutAt: action === "clock_out" ? at : activeShift.clockOutAt,
        events: [...activeShift.events, event],
      };
      if (action === "clock_out") {
        let breakStartedAt: number | null = null;
        let breakMinutes = 0;
        for (const shiftEvent of updated.events) {
          if (shiftEvent.type === "start_break") breakStartedAt = Date.parse(shiftEvent.at);
          if (shiftEvent.type === "end_break" && breakStartedAt !== null) {
            breakMinutes += Math.round((Date.parse(shiftEvent.at) - breakStartedAt) / 60_000);
            breakStartedAt = null;
          }
        }
        const durationMinutes = Math.round((Date.parse(updated.clockOutAt!) - Date.parse(updated.clockInAt!)) / 60_000);
        completed.unshift({
          id: updated.id,
          user_id: "worker-1",
          display_name: "Worker Test",
          work_date: activeWorkDate,
          state: "complete",
          clock_in_at: updated.clockInAt,
          break_started_at: updated.breakStartedAt,
          break_ended_at: updated.breakEndedAt,
          clock_out_at: updated.clockOutAt,
          project_id: updated.projectId,
          project_name: updated.projectName,
          duration_minutes: durationMinutes,
          break_minutes: breakMinutes,
          net_minutes: durationMinutes - breakMinutes,
          events: updated.events,
        });
        currentShift = null;
      } else {
        currentShift = updated;
      }
      return json(route, updated);
    }

    return json(route, { error: `Unhandled test route: ${method} ${path}`, code: "TEST_ROUTE_MISSING" }, 501);
  });

  return { ...control, completedShiftCount: () => completed.length };
}

export function expectCsrfOnWrites(calls: ApiCall[]): void {
  const writes = calls.filter((call) => call.method === "POST");
  expect(writes.length).toBeGreaterThan(0);
  for (const call of writes) {
    expect(call.headers["x-csrf-token"], `${call.method} ${call.path} must send CSRF`).toBe(CSRF_TOKEN);
  }
}

export function expectNoExternalRequests(control: MockApiControl): void {
  expect(control.externalRequests).toEqual([]);
}
