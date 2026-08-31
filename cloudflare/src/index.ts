import {
  changePassword,
  createInvitation,
  getAuth,
  login,
  logout,
  registerWorker,
} from "./auth";
import {
  googleCallback,
  listGoogleAuthRequests,
  reviewGoogleAuthRequest,
  startGoogleAuth,
} from "./googleAuth";
import {
  completePasswordReset,
  issuePasswordReset,
  listPasswordResetRequests,
  rejectPasswordReset,
  requestPasswordReset,
} from "./passwordReset";
import { listRequestHistory } from "./requestHistory";
import {
  getWorkerPayrollProfile,
  listAdminPayrollProfiles,
  revealAdminPayrollProfile,
  saveWorkerPayrollProfile,
} from "./payrollProfiles";
import { getWorkerPayrollSummary } from "./payrollSummary";
import {
  getAdminPayrollSettings,
  saveAdminPayrollSettings,
} from "./payrollSettings";
import { calculateAdminSalaryAdvice } from "./salaryAdvice";
import { enforcePayrollRateLimit } from "./rateLimit";
import {
  ApiError,
  assertAllowedOrigin,
  assertCsrf,
  clearAuthCookies,
  json,
  optionsResponse,
  readJson,
} from "./http";
import {
  createOrUpdateProject,
  createWorkerProject,
  listProjects,
} from "./projects";
import {
  adminAdjustShift,
  adminCreateShift,
  adminShiftHistory,
  adminToday,
  performShiftAction,
  workerShiftHistory,
  workerToday,
} from "./shifts";

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") return optionsResponse(request, env);
  if (request.method === "POST") assertAllowedOrigin(request, env);

  if (request.method === "GET" && path === "/api/auth/google/start") {
    const result = await startGoogleAuth(env, request, url.searchParams.get("mode"));
    const headers = new Headers({ Location: result.location, "Cache-Control": "no-store" });
    for (const cookie of result.cookies) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 302, headers });
  }

  if (request.method === "GET" && path === "/api/auth/google/callback") {
    const result = await googleCallback(env, request);
    const headers = new Headers({ Location: result.location, "Cache-Control": "no-store" });
    for (const cookie of result.cookies) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 302, headers });
  }

  if (request.method === "GET" && path === "/api/health") {
    const database = await env.DB.prepare("SELECT 1 AS ok").first<number>("ok");
    return json(request, env, { ok: database === 1, service: "field-hours-api" });
  }

  if (request.method === "POST" && path === "/api/auth/login") {
    const result = await login(
      env,
      await readJson<{ email?: unknown; password?: unknown }>(request),
    );
    return json(request, env, { user: result.user }, 200, result.cookies);
  }

  if (request.method === "POST" && path === "/api/auth/password-reset/request") {
    return json(request, env, await requestPasswordReset(
      env,
      request,
      await readJson<{ email?: unknown }>(request),
    ));
  }

  if (request.method === "POST" && path === "/api/auth/password-reset/complete") {
    return json(request, env, await completePasswordReset(
      env,
      await readJson<{ token?: unknown; password?: unknown }>(request),
    ));
  }

  if (request.method === "POST" && path === "/api/auth/register") {
    const result = await registerWorker(
      env,
      await readJson<{
        invitationToken?: unknown;
        email?: unknown;
        password?: unknown;
        displayName?: unknown;
      }>(request),
    );
    return json(request, env, { user: result.user }, 201, result.cookies);
  }

  if (request.method === "GET" && path === "/api/session") {
    const auth = await getAuth(request, env);
    return json(request, env, { user: auth.user });
  }

  if (request.method === "POST" && path === "/api/auth/logout") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, { ok: true }, 200, await logout(env, auth));
  }

  if (request.method === "POST" && path === "/api/auth/password") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    const user = await changePassword(
      env,
      auth,
      await readJson<{ password?: unknown }>(request),
    );
    return json(request, env, { user });
  }

  if (request.method === "GET" && path === "/api/auth/google/status") {
    const auth = await getAuth(request, env);
    const identity = await env.DB.prepare(
      "SELECT 1 AS linked FROM workforce_google_identities WHERE user_id = ?1 LIMIT 1",
    ).bind(auth.user.id).first<{ linked: number }>();
    return json(request, env, { linked: Boolean(identity) });
  }

  if (request.method === "GET" && path === "/api/admin/auth-requests") {
    const auth = await getAuth(request, env);
    return json(request, env, await listGoogleAuthRequests(env, auth));
  }

  if (request.method === "GET" && path === "/api/admin/request-history") {
    const auth = await getAuth(request, env);
    return json(request, env, await listRequestHistory(env, auth));
  }

  if (request.method === "GET" && path === "/api/worker/payroll-profile") {
    const auth = await getAuth(request, env);
    return json(request, env, { profile: await getWorkerPayrollProfile(env, auth) });
  }

  if (request.method === "GET" && path === "/api/worker/payroll-summary") {
    const auth = await getAuth(request, env);
    return json(request, env, await getWorkerPayrollSummary(env, auth));
  }

  if (request.method === "POST" && path === "/api/worker/payroll-profile") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, { profile: await saveWorkerPayrollProfile(
      env,
      auth,
      await readJson<{
        legalName?: unknown;
        address?: unknown;
        employeeNumber?: unknown;
        taxReference?: unknown;
        socialReference?: unknown;
        [key: string]: unknown;
      }>(request),
    ) });
  }

  if (request.method === "GET" && path === "/api/admin/payroll-profiles") {
    const auth = await getAuth(request, env);
    return json(request, env, await listAdminPayrollProfiles(env, auth));
  }

  if (request.method === "GET" && path === "/api/admin/payroll-settings") {
    const auth = await getAuth(request, env);
    return json(request, env, await getAdminPayrollSettings(env, auth));
  }

  if (request.method === "POST" && path === "/api/admin/payroll-settings") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, await saveAdminPayrollSettings(
      env,
      auth,
      await readJson<{
        businessName?: unknown;
        businessAddress?: unknown;
        [key: string]: unknown;
      }>(request),
    ));
  }

  if (request.method === "POST" && path === "/api/admin/salary-advice") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    await enforcePayrollRateLimit(env, auth, "payslip_generate");
    return json(request, env, await calculateAdminSalaryAdvice(
      env,
      auth,
      await readJson<{
        userId?: unknown;
        periodType?: unknown;
        periodStart?: unknown;
        payDate?: unknown;
        hourlyRate?: unknown;
        itisRate?: unknown;
        workerSocialSecurityRate?: unknown;
        weeklyWorkerSocialSecurity?: unknown;
        yearToDateGrossTaxablePay?: unknown;
        yearToDateTaxPaid?: unknown;
        [key: string]: unknown;
      }>(request),
    ));
  }

  const payrollProfileMatch = path.match(/^\/api\/admin\/payroll-profiles\/([^/]+)\/reveal$/);
  if (payrollProfileMatch && request.method === "POST") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    const userId = decodeURIComponent(payrollProfileMatch[1] ?? "");
    await enforcePayrollRateLimit(env, auth, "profile_reveal");
    return json(request, env, await revealAdminPayrollProfile(env, auth, userId));
  }

  if (request.method === "GET" && path === "/api/admin/password-reset-requests") {
    const auth = await getAuth(request, env);
    return json(request, env, await listPasswordResetRequests(env, auth));
  }

  const passwordResetRequestMatch = path.match(/^\/api\/admin\/password-reset-requests\/([^/]+)\/issue$/);
  if (request.method === "POST" && passwordResetRequestMatch) {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, await issuePasswordReset(
      env,
      auth,
      decodeURIComponent(passwordResetRequestMatch[1] ?? ""),
    ));
  }

  const passwordResetRejectMatch = path.match(/^\/api\/admin\/password-reset-requests\/([^/]+)\/reject$/);
  if (request.method === "POST" && passwordResetRejectMatch) {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    const body = await readJson<{ reason?: unknown }>(request);
    return json(request, env, await rejectPasswordReset(
      env,
      auth,
      decodeURIComponent(passwordResetRejectMatch[1] ?? ""),
      body.reason,
    ));
  }

  const authRequestMatch = path.match(/^\/api\/admin\/auth-requests\/([^/]+)\/(approve|reject)$/);
  if (request.method === "POST" && authRequestMatch) {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, await reviewGoogleAuthRequest(
      env,
      auth,
      decodeURIComponent(authRequestMatch[1] ?? ""),
      { ...(await readJson<{ reason?: unknown }>(request)), decision: authRequestMatch[2] === "approve" ? "approve" : "reject" },
    ));
  }

  if (request.method === "POST" && path === "/api/invitations") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, await createInvitation(env, auth), 201);
  }

  if (request.method === "GET" && path === "/api/projects") {
    const auth = await getAuth(request, env);
    return json(request, env, await listProjects(env, auth));
  }

  if (request.method === "POST" && path === "/api/worker/projects") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, await createWorkerProject(
      env,
      auth,
      await readJson<{ name?: unknown; description?: unknown }>(request),
    ), 201);
  }

  if (request.method === "POST" && path === "/api/admin/projects") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    const result = await createOrUpdateProject(
      env,
      auth,
      await readJson<{
        id?: unknown;
        name?: unknown;
        code?: unknown;
        address?: unknown;
        latitude?: unknown;
        longitude?: unknown;
        radiusM?: unknown;
        isActive?: unknown;
      }>(request),
    );
    return json(request, env, result);
  }

  if (request.method === "GET" && path === "/api/worker/today") {
    const auth = await getAuth(request, env);
    return json(request, env, await workerToday(env, auth));
  }

  if (request.method === "GET" && path === "/api/worker/shifts/history") {
    const auth = await getAuth(request, env);
    return json(request, env, await workerShiftHistory(env, auth, url.searchParams));
  }

  if (request.method === "GET" && path === "/api/admin/today") {
    const auth = await getAuth(request, env);
    return json(request, env, await adminToday(env, auth));
  }

  if (request.method === "GET" && path === "/api/admin/shifts/history") {
    const auth = await getAuth(request, env);
    return json(request, env, await adminShiftHistory(env, auth, url.searchParams));
  }

  if (request.method === "POST" && path === "/api/admin/shifts/adjust") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    const result = await adminAdjustShift(
      env,
      auth,
      await readJson<{
        shiftId?: unknown;
        clockInAt?: unknown;
        clockOutAt?: unknown;
        reason?: unknown;
      }>(request),
    );
    return json(request, env, result);
  }

  if (request.method === "POST" && path === "/api/admin/shifts/create") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    const result = await adminCreateShift(
      env,
      auth,
      await readJson<{
        userId?: unknown;
        projectId?: unknown;
        clockInAt?: unknown;
        clockOutAt?: unknown;
        description?: unknown;
      }>(request),
    );
    return json(request, env, result);
  }

  if (request.method === "POST" && path === "/api/shift/action") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    const snapshot = await performShiftAction(
      env,
      auth,
      await readJson<{
        action?: unknown;
        location?: unknown;
        idempotencyKey?: unknown;
        projectId?: unknown;
      }>(request),
    );
    return json(request, env, snapshot);
  }

  throw new ApiError(404, "NOT_FOUND", "The requested endpoint does not exist.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof ApiError) {
        const cookies = error.code === "UNAUTHENTICATED" ? clearAuthCookies() : [];
        return json(
          request,
          env,
          { error: error.message, code: error.code },
          error.status,
          cookies,
          error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {},
        );
      }
      console.error(JSON.stringify({
        level: "error",
        event: "unhandled_request_error",
        path: new URL(request.url).pathname,
        requestId: request.headers.get("cf-ray") ?? crypto.randomUUID(),
        errorName: error instanceof Error ? error.name : "UnknownError",
      }));
      return json(
        request,
        env,
        { error: "The service could not complete this request.", code: "INTERNAL_ERROR" },
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
