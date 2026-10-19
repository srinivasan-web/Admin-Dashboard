import { cachedRead, invalidateAfterWrite, invalidateReads } from "./readCache.js";
const apiBase = "/api/v1/admin";
export class ApiError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
async function csrfToken() {
    const response = await fetch(`${apiBase}/auth/csrf`, {
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new ApiError("Could not establish a secure session.", response.status);
    }
    return (await response.json()).data
        .csrf_token;
}
async function handleResponse(response) {
    const payload = (await response.json().catch(() => ({})));
    if (!response.ok) {
        if (response.status === 401) {
            invalidateReads();
            window.dispatchEvent(new Event("durafit:admin-session-expired"));
        }
        throw new ApiError(payload.error?.message ?? "Request failed.", response.status, payload.error?.details);
    }
    return payload;
}
export async function apiRequest(path, method = "GET", body, options) {
    const headers = { Accept: "application/json" };
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
    try {
        return await handleResponse(response);
    }
    finally {
        if (method !== "GET")
            invalidateAfterWrite(path);
    }
}
export function cachedApiRequest(path, options = {}) {
    const root = path.split("/")[1].split("?")[0];
    const ttl = ["products", "combos", "merchandising"].includes(root) ? 30_000
        : root === "warehouse-stocks" || path.endsWith("/stock") ? 15_000 : 300_000;
    return cachedRead(path, (signal) => apiRequest(path, "GET", undefined, { signal }), { ...options, ttl });
}
export async function apiFormRequest(path, body) {
    const response = await fetch(`${apiBase}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "X-CSRF-TOKEN": await csrfToken() },
        body,
    });
    try {
        return await handleResponse(response);
    }
    finally {
        invalidateAfterWrite(path);
    }
}
export async function apiDownload(path) {
    const response = await fetch(`${apiBase}${path}`, {
        credentials: "include",
        headers: { Accept: "text/csv" },
    });
    if (!response.ok) {
        await handleResponse(response);
    }
    return response.blob();
}
export function errorMessage(error) {
    if (error instanceof ApiError && error.status === 401) {
        return "Your session has expired. Please sign in again.";
    }
    if (error instanceof ApiError && error.details) {
        return Object.values(error.details).flat().join(" ");
    }
    return error instanceof Error ? error.message : "Request failed.";
}
