export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "worker";
  organizationId: string;
  organizationName: string;
  timezone: string;
  mustChangePassword: boolean;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function csrfToken(): string {
  for (const part of document.cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "fh_csrf") return value.join("=");
  }
  return "";
}

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; csrf?: boolean } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.csrf) {
    const token = csrfToken();
    if (!token) throw new ApiClientError("Your session security token is missing. Sign in again.", 401, "CSRF_MISSING");
    headers.set("X-CSRF-Token", token);
  }
  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    redirect: "error",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const contentType = response.headers.get("Content-Type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json() as { error?: string; code?: string } & T
    : null;
  if (!response.ok) {
    throw new ApiClientError(
      payload?.error ?? "The service could not complete this request.",
      response.status,
      payload?.code ?? "REQUEST_FAILED",
    );
  }
  if (payload === null) throw new ApiClientError("The service returned an invalid response.", 502, "INVALID_RESPONSE");
  return payload;
}

export const backend = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown, csrf = false) => request<T>(path, {
    method: "POST",
    body,
    csrf,
  }),
};
