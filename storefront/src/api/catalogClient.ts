export class CatalogError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function catalogRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new CatalogError(
      response.status,
      response.status === 404
        ? "This product is no longer available. Explore the catalog to find an alternative."
        : "We couldn't load this information. Please try again.",
    );
  }
  try {
    return await response.json() as T;
  } catch {
    throw new CatalogError(502, "We couldn't read the product information. Please try again.");
  }
}

type Pending = {
  promise: Promise<unknown>;
  controller: AbortController;
  consumers: number;
};
const pending = new Map<string, Pending>();

/** Share pending reads only. Completed data is fetched again on navigation or refresh. */
export function acquireCatalogRequest<T>(path: string) {
  let entry = pending.get(path);
  if (!entry) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    const promise = catalogRequest<unknown>(path, controller.signal)
      .catch((error: unknown) => {
        if (timedOut) throw new CatalogError(0, "This request took too long. Please try again.");
        throw error;
      })
      .finally(() => {
        clearTimeout(timer);
        if (pending.get(path) === entry) pending.delete(path);
      });
    entry = { promise, controller, consumers: 0 };
    pending.set(path, entry);
  }
  const request = entry;
  request.consumers++;
  let released = false;
  return {
    promise: request.promise as Promise<T>,
    release() {
      if (released) return;
      released = true;
      request.consumers--;
      // Allow an effect to resubscribe before cancelling the last shared read.
      queueMicrotask(() => {
        if (request.consumers === 0 && pending.get(path) === request) {
          pending.delete(path);
          request.controller.abort();
        }
      });
    },
  };
}
