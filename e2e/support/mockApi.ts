import { expect, type BrowserContext, type Route } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:4187";
const CSRF_TOKEN = "synthetic-e2e-csrf-token";
const NOW = "2026-08-25T09:00:00.000Z";

type Role = "admin" | "worker";
export type MockLanguage = "en" | "es" | "pt";
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
  language: MockLanguage = "en",
): Promise<MockApiControl> {
  const calls: ApiCall[] = [];
  const externalRequests: string[] = [];

  await context.addCookies([{ name: "fh_csrf", value: CSRF_TOKEN, url: APP_ORIGIN }]);
  await context.addInitScript((selectedLanguage: MockLanguage) => {
    localStorage.clear();
    localStorage.setItem("fh_lang", selectedLanguage);
  }, language);
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
  options: {
    denseData?: boolean;
    language?: MockLanguage;
    salaryAdviceError?: boolean;
    salaryAdviceDelayMs?: number;
    settingsDelayMs?: number;
    settingsError?: boolean;
  } = {},
): Promise<MockApiControl> {
  const baseAdminPerson = {
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
  };
  const denseAdminPeople = Array.from({ length: 13 }, (_, index) => {
    const sequence = index + 2;
    const state: ShiftState = index % 3 === 0 ? "working" : index % 3 === 1 ? "on_break" : "off_shift";
    const clockInAt = state === "off_shift" ? null : `2026-08-25T${String(7 + (index % 3)).padStart(2, "0")}:00:00.000Z`;
    const event: ShiftEvent | null = clockInAt
      ? {
          id: `dense-event-${sequence}`,
          type: "clock_in",
          at: clockInAt,
          location: { latitude: 49.2144 + index / 10_000, longitude: -2.1313, accuracy: 12 + index },
        }
      : null;
    return {
      ...baseAdminPerson,
      user_id: `worker-${sequence}`,
      display_name: `Worker ${String(sequence).padStart(2, "0")} With Long Name`,
      state,
      clock_in_at: clockInAt,
      break_started_at: state === "on_break" ? `2026-08-25T12:${String(index).padStart(2, "0")}:00.000Z` : null,
      project_id: `project-${(index % 8) + 1}`,
      project_name: `Jersey Operations Site ${(index % 8) + 1}`,
      events: event ? [event] : [],
    };
  });
  const adminPeople = options.denseData ? [baseAdminPerson, ...denseAdminPeople] : [baseAdminPerson];
  const baseAdminProject: Project = {
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
  };
  const adminProjects: Project[] = options.denseData
    ? [baseAdminProject, ...Array.from({ length: 11 }, (_, index) => ({
        ...baseAdminProject,
        id: `project-${index + 2}`,
        name: `Jersey Operations Site ${index + 2} — Waterfront Refurbishment`,
        description: `Dense test project ${index + 2} with a deliberately descriptive operational name.`,
        code: `SITE-${String(index + 2).padStart(2, "0")}`,
        address: `${index + 2} Esplanade, St Helier, Jersey`,
        is_active: index % 4 !== 3,
      }))]
    : [baseAdminProject];
  let adminHistory: Array<Record<string, unknown>> = options.denseData
    ? Array.from({ length: 18 }, (_, index) => ({
        id: `dense-history-${index + 1}`,
        user_id: `worker-${(index % 8) + 1}`,
        display_name: index === 0 ? "Worker Test" : `Worker ${String((index % 8) + 1).padStart(2, "0")} With Long Name`,
        work_date: `2026-08-${String(24 - (index % 18)).padStart(2, "0")}`,
        state: "complete",
        clock_in_at: `2026-08-${String(24 - (index % 18)).padStart(2, "0")}T08:00:00.000Z`,
        break_started_at: null,
        break_ended_at: null,
        clock_out_at: `2026-08-${String(24 - (index % 18)).padStart(2, "0")}T16:30:00.000Z`,
        project_id: `project-${(index % 8) + 1}`,
        project_name: `Jersey Operations Site ${(index % 8) + 1}`,
        duration_minutes: 510,
        break_minutes: 30,
        net_minutes: 480,
        events: [],
        admin_adjustment: index % 5 === 0
          ? { kind: "adjusted", reason: "Supervisor reconciled the signed site record.", adjusted_at: NOW }
          : null,
      }))
    : [];
  const denseGoogleRequests = Array.from({ length: 4 }, (_, index) => ({
    id: `google-request-${index + 1}`,
    organizationId: "org-1",
    requestType: index % 2 === 0 ? "access" : "migration",
    email: `pending-google-${index + 1}@field-hours.test`,
    displayName: `Pending Google User ${index + 1}`,
    existingUserId: index % 2 === 0 ? null : `worker-${index + 2}`,
    requestedAt: `2026-08-2${index}T09:00:00.000Z`,
  }));
  const densePasswordRequests = Array.from({ length: 4 }, (_, index) => ({
    id: `password-request-${index + 1}`,
    userId: `worker-${index + 2}`,
    organizationId: "org-1",
    email: `password-reset-${index + 1}@field-hours.test`,
    displayName: `Password Reset User ${index + 1}`,
    requestedAt: `2026-08-2${index}T10:00:00.000Z`,
  }));
  const denseRequestHistory = Array.from({ length: 12 }, (_, index) => ({
    id: `request-history-${index + 1}`,
    category: index % 2 === 0 ? "google" : "password_reset",
    requestType: index % 2 === 0 ? "access" : "reset",
    email: `reviewed-${index + 1}@field-hours.test`,
    displayName: `Reviewed Account ${index + 1}`,
    status: index % 3 === 0 ? "approved" : index % 3 === 1 ? "rejected" : "completed",
    reason: index % 3 === 1 ? "Identity could not be confirmed from the submitted request." : null,
    requestedAt: `2026-08-${String(20 - (index % 12)).padStart(2, "0")}T09:00:00.000Z`,
    reviewedAt: `2026-08-${String(20 - (index % 12)).padStart(2, "0")}T10:00:00.000Z`,
    reviewerName: "Admin Test",
  }));
  let profile = {
    userId: "worker-1",
    displayName: "Worker Test",
    email: "worker@field-hours.test",
    employeeNumber: "EMP-001",
    hourlyRate: 20,
    itisRate: 17,
    isComplete: true,
    savedAt: NOW,
  };
  let secondProfile = {
    userId: "worker-2",
    displayName: "Second Worker",
    email: "second@field-hours.test",
    employeeNumber: "EMP-002",
    hourlyRate: 15,
    itisRate: 22,
    isComplete: true,
    savedAt: NOW,
  };
  let settings = {
    businessName: "Field Hours Test",
    businessAddress: "1 Test Street",
    updatedAt: NOW,
  };

  return prepareContext(context, async (route, path, method, body) => {
    if (method === "GET" && path === "/api/session") return json(route, { user: sessionUser("admin") });
    if (method === "GET" && path === "/api/admin/today") return json(route, adminPeople);
    if (method === "GET" && path === "/api/projects") return json(route, adminProjects);
    if (method === "GET" && path === "/api/admin/shifts/history") return json(route, adminHistory);
    if (method === "GET" && path === "/api/admin/auth-requests") return json(route, options.denseData ? denseGoogleRequests : []);
    if (method === "GET" && path === "/api/admin/password-reset-requests") return json(route, options.denseData ? densePasswordRequests : []);
    if (method === "GET" && path === "/api/admin/request-history") return json(route, options.denseData ? denseRequestHistory : []);
    if (method === "GET" && path === "/api/admin/payroll-profiles") return json(route, [profile, secondProfile]);
    if (method === "GET" && path === "/api/admin/payroll-settings") return json(route, settings);

    if (method === "POST" && path === "/api/admin/payroll-settings") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const input = body as Record<string, unknown> | undefined;
      const keys = Object.keys(input ?? {}).sort();
      if (
        JSON.stringify(keys) !== JSON.stringify(["businessAddress", "businessName"])
        || typeof input?.businessName !== "string"
        || typeof input.businessAddress !== "string"
      ) {
        return json(route, { error: "Unexpected Salary Advice settings contract", code: "INVALID_INPUT" }, 400);
      }
      if (options.settingsDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.settingsDelayMs));
      }
      if (options.settingsError) {
        return json(route, { error: "Business details could not be saved.", code: "SETTINGS_WRITE_FAILED" }, 409);
      }
      settings = {
        businessName: input.businessName,
        businessAddress: input.businessAddress,
        updatedAt: NOW,
      };
      return json(route, settings);
    }

    const compensationMatch = path.match(/^\/api\/admin\/payroll-profiles\/([^/]+)\/compensation$/);
    if (method === "POST" && compensationMatch) {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const input = body as Record<string, unknown> | undefined;
      if (
        JSON.stringify(Object.keys(input ?? {}).sort()) !== JSON.stringify(["hourlyRate", "itisRate"])
        || typeof input?.hourlyRate !== "number"
        || typeof input.itisRate !== "number"
        || !Number.isInteger(input.itisRate)
        || input.itisRate < 0
        || input.itisRate > 100
      ) {
        return json(route, { error: "Unexpected compensation contract", code: "INVALID_INPUT" }, 400);
      }
      const updated = compensationMatch[1] === "worker-2"
        ? { ...secondProfile, hourlyRate: input.hourlyRate, itisRate: input.itisRate }
        : { ...profile, hourlyRate: input.hourlyRate, itisRate: input.itisRate };
      if (compensationMatch[1] === "worker-2") secondProfile = updated;
      else profile = updated;
      return json(route, updated);
    }

    if (method === "POST" && path === "/api/admin/payroll-profiles/worker-1/reveal") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      if (JSON.stringify(body) !== "{}") return json(route, { error: "Unexpected contract", code: "INVALID_INPUT" }, 400);
      return json(route, {
        ...profile,
        legalName: "Worker Test",
        address: "1 Worker Road",
        taxReference: "TAX-123",
        socialReference: "SOC-9012",
      });
    }

    if (method === "POST" && path === "/api/admin/salary-advice") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const input = body as Record<string, unknown> | undefined;
      const keys = Object.keys(input ?? {}).sort();
      const periodType = input?.periodType;
      const periodStart = input?.periodStart;
      const payDate = input?.payDate;
      const expectedKeys = ["payDate", "periodStart", "periodType", "userId"];
      const parsedStart = typeof periodStart === "string" ? new Date(`${periodStart}T00:00:00Z`) : new Date(Number.NaN);
      const parsedPayDate = typeof payDate === "string" ? new Date(`${payDate}T00:00:00Z`) : new Date(Number.NaN);
      const isWeeklyStart = periodType === "weekly" && parsedStart.getUTCDay() === 1;
      const isMonthlyStart = periodType === "monthly" && parsedStart.getUTCDate() === 1;
      if (
        JSON.stringify(keys) !== JSON.stringify(expectedKeys)
        || (input?.userId !== "worker-1" && input?.userId !== "worker-2")
        || (periodType !== "weekly" && periodType !== "monthly")
        || typeof periodStart !== "string"
        || !/^2026-\d{2}-\d{2}$/.test(periodStart)
        || Number.isNaN(parsedStart.valueOf())
        || parsedStart.toISOString().slice(0, 10) !== periodStart
        || (!isWeeklyStart && !isMonthlyStart)
        || typeof payDate !== "string"
        || !/^2026-\d{2}-\d{2}$/.test(payDate)
        || Number.isNaN(parsedPayDate.valueOf())
        || parsedPayDate.toISOString().slice(0, 10) !== payDate
        || payDate < periodStart
      ) {
        return json(route, { error: "Unexpected Salary Advice contract", code: "INVALID_INPUT" }, 400);
      }
      const end = new Date(parsedStart);
      if (periodType === "weekly") end.setUTCDate(end.getUTCDate() + 6);
      else end.setUTCMonth(end.getUTCMonth() + 1, 0);
      if (end.getUTCFullYear() !== 2026) {
        return json(route, { error: "Salary Advice rules are configured for 2026 only.", code: "RULES_NOT_AVAILABLE" }, 409);
      }
      if (options.salaryAdviceError) {
        return json(route, {
          error: "Salary Advice could not be calculated for the selected period.",
          code: "SALARY_ADVICE_NOT_CONFIGURED",
        }, 409);
      }
      if (options.salaryAdviceDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.salaryAdviceDelayMs));
      }

      const netMinutes = periodType === "weekly" ? 2400 : 7200;
      const shiftCount = periodType === "weekly" ? 5 : 12;
      const hours = netMinutes / 60;
      const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
      const selectedProfile = input?.userId === "worker-2" ? secondProfile : profile;
      const hourlyRate = selectedProfile.hourlyRate as number;
      const itisRate = selectedProfile.itisRate as number;
      const grossTaxablePay = roundMoney(hours * hourlyRate);
      const incomeTax = roundMoney(grossTaxablePay * (itisRate / 100));
      const workerSocialSecurity = roundMoney(grossTaxablePay * 0.06);
      const total = roundMoney(incomeTax + workerSocialSecurity);

      return json(route, {
        calculatedAt: NOW,
        currency: "GBP",
        isEstimate: true,
        period: {
          type: periodType,
          start: periodStart,
          end: end.toISOString().slice(0, 10),
          payDate,
        },
        employer: { name: settings.businessName, address: settings.businessAddress },
        worker: input.userId === "worker-2"
          ? {
              userId: "worker-2",
              displayName: "Second Worker",
              legalName: "Second Worker",
              address: "2 Worker Road",
              employeeNumber: "EMP-002",
              taxReference: "TAX-456",
              socialReference: "SOC-3456",
            }
          : {
              userId: "worker-1",
              displayName: "Worker Test",
              legalName: "Worker Test",
              address: "1 Worker Road",
              employeeNumber: "EMP-001",
              taxReference: "TAX-123",
              socialReference: "SOC-9012",
            },
        allowance: {
          description: "Basic Hourly Pay",
          shiftCount,
          netMinutes,
          hours,
          hourlyRate,
          amount: grossTaxablePay,
        },
        deductions: {
          itisRate,
          incomeTax,
          workerSocialSecurityRate: 6,
          workerSocialSecuritySource: "calculated_from_saved_hours",
          workerSocialSecurity,
          total,
        },
        grossTaxablePay,
        netPay: roundMoney(grossTaxablePay - total),
        totalsToDate: {
          grossTaxablePay,
          taxPaid: incomeTax,
          source: "calculated_from_saved_hours",
        },
        warnings: [],
      });
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

    return json(route, { error: `Unhandled test route: ${method} ${path}`, code: "TEST_ROUTE_MISSING" }, 501);
  }, options.language);
}

export async function installWorkerApi(
  context: BrowserContext,
  options: {
    adminCreatedHistory?: boolean;
    adjustedHistory?: boolean;
    denseData?: boolean;
    failFirstClockOutNetwork?: boolean;
    language?: MockLanguage;
    overnightOpenShift?: boolean;
  } = {},
): Promise<WorkerMockControl> {
  const baseWorkerProject: Project = {
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
  };
  let projects: Project[] = options.denseData
    ? [baseWorkerProject, ...Array.from({ length: 9 }, (_, index) => ({
        ...baseWorkerProject,
        id: `project-${index + 2}`,
        name: `Worker Site ${index + 2} — Long Waterfront Assignment`,
        description: `Dense worker project ${index + 2}`,
        code: `WS-${String(index + 2).padStart(2, "0")}`,
        address: `${index + 20} Commercial Buildings, St Helier`,
      }))]
    : [baseWorkerProject];
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
  const seededNotice: Record<string, unknown> = {
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
    };
  const completed: Array<Record<string, unknown>> = options.denseData
    ? Array.from({ length: 20 }, (_, index) => ({
        id: `worker-history-${index + 1}`,
        user_id: "worker-1",
        display_name: "Worker Test",
        work_date: `2026-08-${String(24 - (index % 20)).padStart(2, "0")}`,
        state: "complete",
        clock_in_at: `2026-08-${String(24 - (index % 20)).padStart(2, "0")}T08:00:00.000Z`,
        break_started_at: null,
        break_ended_at: null,
        clock_out_at: `2026-08-${String(24 - (index % 20)).padStart(2, "0")}T16:30:00.000Z`,
        project_id: `project-${(index % 8) + 1}`,
        project_name: `Worker Site ${(index % 8) + 1} — Long Waterfront Assignment`,
        duration_minutes: 510,
        break_minutes: index % 2 === 0 ? 30 : 45,
        net_minutes: index % 2 === 0 ? 480 : 465,
        events: [],
        admin_adjustment: index === 0
          ? { kind: "adjusted", reason: "Supervisor reconciled the signed site record.", adjusted_at: NOW }
          : null,
      }))
    : options.adjustedHistory || options.adminCreatedHistory
      ? [seededNotice]
      : [];
  let shiftSequence = 0;
  let eventSequence = currentShift?.events.length ?? 0;
  let failedClockOutOnce = false;
  let workerPayrollProfile: Record<string, unknown> | null = null;
  const eventOffsetsInMinutes = [0, 15, 25, 40, 65, 90, 120, 150];

  const control = await prepareContext(context, async (route, path, method, body) => {
    if (method === "GET" && path === "/api/session") return json(route, { user: sessionUser("worker") });
    if (method === "GET" && path === "/api/worker/today") return json(route, currentShift ?? emptyShift());
    if (method === "GET" && path === "/api/projects") return json(route, projects);
    if (method === "GET" && path === "/api/worker/shifts/history") return json(route, completed);
    if (method === "GET" && path === "/api/worker/payroll-profile") return json(route, { profile: workerPayrollProfile });
    if (method === "GET" && path === "/api/worker/payroll-summary") {
      const completedMinutes = completed.reduce((total, shift) => total + Number(shift.net_minutes ?? 0), 0);
      return json(route, {
        timezone: "Europe/Jersey",
        asOfDate: "2026-08-25",
        currentMonthStart: "2026-08-01",
        currentMonthMinutes: completedMinutes,
        currentMonthShifts: completed.length,
        totalCompletedMinutes: completedMinutes,
        totalCompletedShifts: completed.length,
      });
    }

    if (method === "POST" && path === "/api/worker/payroll-profile") {
      if (!assertCsrf(route)) return json(route, { error: "CSRF token missing", code: "CSRF_INVALID" }, 403);
      const input = body as Record<string, unknown>;
      if (
        typeof input?.legalName !== "string"
        || typeof input.address !== "string"
        || typeof input.employeeNumber !== "string"
        || typeof input.itisRate !== "number"
        || !Number.isInteger(input.itisRate)
        || input.itisRate < 0
        || input.itisRate > 100
      ) {
        return json(route, { error: "Payroll profile is invalid", code: "INVALID_INPUT" }, 400);
      }
      workerPayrollProfile = {
        userId: "worker-1",
        displayName: "Worker Test",
        employeeNumber: input.employeeNumber,
        hourlyRate: null,
        itisRate: input.itisRate,
        isComplete: true,
        savedAt: NOW,
        legalName: input.legalName,
        address: input.address,
        hasTaxReference: typeof input.taxReference === "string" || false,
        hasSocialReference: typeof input.socialReference === "string" || false,
      };
      return json(route, { profile: workerPayrollProfile });
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
  }, options.language);

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
