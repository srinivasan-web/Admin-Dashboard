import axios from "axios";

const apiBase = "/api/v1/admin";

export const apiClient = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const headers = config.headers ?? {};

  if (
    config.method &&
    !["get", "head", "delete"].includes(config.method.toLowerCase())
  ) {
    const token = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("XSRF-TOKEN="));

    if (token) {
      headers["X-XSRF-TOKEN"] = decodeURIComponent(token.split("=")[1]);
    }
  }

  config.headers = headers;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      window.dispatchEvent(new Event("durafit:admin-session-expired"));
    }

    return Promise.reject(error);
  },
);

export function normalizeApiError(error: unknown): string {
  const message =
    error && typeof error === "object" && "response" in error
      ? (error as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message
      : undefined;

  return message ?? "Request failed.";
}
