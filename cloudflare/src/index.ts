import {
  changePassword,
  createInvitation,
  getAuth,
  login,
  logout,
  registerWorker,
} from "./auth";
import {
  ApiError,
  assertAllowedOrigin,
  assertCsrf,
  clearAuthCookies,
  json,
  optionsResponse,
  readJson,
} from "./http";
import { adminToday, performShiftAction, workerToday } from "./shifts";

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") return optionsResponse(request, env);
  if (request.method === "POST") assertAllowedOrigin(request, env);

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

  if (request.method === "POST" && path === "/api/invitations") {
    const auth = await getAuth(request, env);
    await assertCsrf(request, auth);
    return json(request, env, await createInvitation(env, auth), 201);
  }

  if (request.method === "GET" && path === "/api/worker/today") {
    const auth = await getAuth(request, env);
    return json(request, env, await workerToday(env, auth));
  }

  if (request.method === "GET" && path === "/api/admin/today") {
    const auth = await getAuth(request, env);
    return json(request, env, await adminToday(env, auth));
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
