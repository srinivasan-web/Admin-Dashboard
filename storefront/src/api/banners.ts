import { useSyncExternalStore } from "react";
import { subscribeBannerUpdates } from "../../../shared/bannerUpdates";
import type { Collection, PublicBanner } from "./catalog";

type Snapshot = {
  data?: Collection<PublicBanner>;
  error?: Error;
  refreshing: boolean;
};
const serverSnapshot: Snapshot = { refreshing: false };
let snapshot: Snapshot = serverSnapshot;
let etag: string | undefined;
let controller: AbortController | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let queued = false;
let failures = 0;
let removeUpdates: (() => void) | undefined;
const listeners = new Set<() => void>();

function publish(value: Snapshot) {
  snapshot = value;
  listeners.forEach((listener) => listener());
}
function schedule(delay = Math.min(15_000 * 2 ** failures, 60_000)) {
  clearTimeout(timer);
  if (listeners.size && !document.hidden)
    timer = setTimeout(() => {
      void refresh();
    }, delay);
}
async function refresh() {
  if (!listeners.size || document.hidden) return;
  if (controller) {
    queued = true;
    return;
  }
  const request = new AbortController();
  controller = request;
  const timeout = setTimeout(() => request.abort(), 10_000);
  publish({ ...snapshot, refreshing: true });
  try {
    const response = await fetch("/api/v1/banners/active", {
      headers: {
        Accept: "application/json",
        ...(etag ? { "If-None-Match": etag } : {}),
      },
      cache: "no-store",
      signal: request.signal,
    });
    if (controller !== request || !listeners.size) return;
    if (response.status === 304 && snapshot.data) {
      publish({ ...snapshot, error: undefined, refreshing: false });
    } else {
      if (!response.ok)
        throw new Error("Campaigns couldn’t be refreshed. Please try again.");
      const data = (await response.json()) as Collection<PublicBanner>;
      if (controller !== request || !listeners.size) return;
      if (!Array.isArray(data.data))
        throw new Error("Campaigns couldn’t be refreshed. Please try again.");
      etag = response.headers.get("ETag") ?? undefined;
      publish({ data, error: undefined, refreshing: false });
    }
    failures = 0;
  } catch (reason) {
    if (listeners.size && controller === request) {
      failures++;
      publish({
        ...snapshot,
        refreshing: false,
        error:
          reason instanceof Error && reason.name !== "AbortError"
            ? reason
            : new Error("Campaigns couldn’t be refreshed. Please try again."),
      });
    }
  } finally {
    clearTimeout(timeout);
    if (controller === request) {
      controller = undefined;
      schedule(queued ? 250 : undefined);
      queued = false;
    }
  }
}
function requestRefresh() {
  clearTimeout(timer);
  void refresh();
}
function visibilityChanged() {
  if (document.hidden) clearTimeout(timer);
  else requestRefresh();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("focus", requestRefresh);
    window.addEventListener("online", requestRefresh);
    removeUpdates = subscribeBannerUpdates(() => {
      schedule(150);
    });
    requestRefresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
    queued = false;
    removeUpdates?.();
    document.removeEventListener("visibilitychange", visibilityChanged);
    window.removeEventListener("focus", requestRefresh);
    window.removeEventListener("online", requestRefresh);
  };
}

/** One conditional request shared by all campaign consumers in this tab. */
export function usePublicBanners() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => serverSnapshot,
  );
  return { ...state, retry: requestRefresh };
}
