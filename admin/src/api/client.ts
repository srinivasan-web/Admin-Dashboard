import { cachedRead, invalidateAfterWrite, invalidateReads } from "./readCache";

export type ApiResponse<T> = { data: T };

type ErrorPayload = {
  error?: {
    code?: string;
    details?: Record<string, string[]>;
    message?: string;
  };
};

const apiBase = "/api/v1/admin";

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${apiBase}/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new ApiError(
      "Could not establish a secure session.",
      response.status,
    );
  }

  return ((await response.json()) as ApiResponse<{ csrf_token: string }>).data
    .csrf_token;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;

  if (!response.ok) {
    if (response.status === 401) {
      invalidateReads();
      window.dispatchEvent(new Event("durafit:admin-session-expired"));
    }

    throw new ApiError(
      payload.error?.message ?? "Request failed.",
      response.status,
      payload.error?.details,
    );
  }

  return payload as T;
}

export async function apiRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const headers: HeadersInit = { Accept: "application/json" };
  if (method !== "GET" && path.startsWith("/auth/")) invalidateReads();
  try {
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      headers["X-CSRF-TOKEN"] = await csrfToken();
    }

    const response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options?.signal,
    });
    return await handleResponse<T>(response);
  } finally {
    if (method !== "GET") invalidateAfterWrite(path);
  }
}

export function cachedApiRequest<T>(
  path: string,
  options: { signal?: AbortSignal; force?: boolean } = {},
): Promise<T> {
  const root = path.split("/")[1].split("?")[0];
  const ttl = ["products", "combos", "merchandising"].includes(root)
    ? 30_000
    : root === "warehouse-stocks" || path.endsWith("/stock")
      ? 15_000
      : 300_000;
  return cachedRead(
    path,
    (signal) => apiRequest<T>(path, "GET", undefined, { signal }),
    { ...options, ttl },
  );
}

export async function apiFormRequest<T>(
  path: string,
  body: FormData,
): Promise<T> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-CSRF-TOKEN": await csrfToken(),
      },
      body,
    });

    return await handleResponse<T>(response);
  } finally {
    invalidateAfterWrite(path);
  }
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { Accept: "text/csv" },
  });
  if (!response.ok) {
    await handleResponse(response);
  }
  return response.blob();
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (error instanceof ApiError && error.details) {
    return Object.values(error.details).flat().join(" ");
  }

  return error instanceof Error ? error.message : "Request failed.";
}
