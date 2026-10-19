const entries = new Map();
export function invalidateReads(matches = () => true) {
    for (const [path, entry] of entries) {
        if (!matches(path))
            continue;
        clearTimeout(entry.cancel);
        entry.controller.abort();
        entries.delete(path);
    }
}
// Only callers that explicitly opt in use this in-memory read cache.
export function cachedRead(path, load, { signal, force = false, ttl = 30_000 } = {}) {
    if (signal?.aborted)
        return Promise.reject(new DOMException("Aborted", "AbortError"));
    let entry = entries.get(path);
    if (entry?.settled && (force || entry.expires <= Date.now())) {
        entries.delete(path);
        entry = undefined;
    }
    if (!entry) {
        for (const [key, item] of entries) {
            if (item.settled && (item.expires <= Date.now() || entries.size >= 100))
                entries.delete(key);
        }
        const controller = new AbortController();
        const created = { controller, users: new Set(), settled: false, expires: 0,
            promise: Promise.resolve().then(() => load(controller.signal)) };
        created.promise = created.promise.then((value) => {
            created.settled = true;
            created.expires = Date.now() + ttl;
            return value;
        }, (error) => {
            if (entries.get(path) === created)
                entries.delete(path);
            throw error;
        });
        entries.set(path, created);
        entry = created;
    }
    const shared = entry;
    clearTimeout(shared.cancel);
    const user = Symbol();
    shared.users.add(user);
    return new Promise((resolve, reject) => {
        const release = () => {
            signal?.removeEventListener("abort", abort);
            shared.users.delete(user);
            if (!shared.settled && shared.users.size === 0) {
                // A same-tick remount (including StrictMode) may reuse the request.
                shared.cancel = setTimeout(() => {
                    if (shared.users.size || shared.settled)
                        return;
                    if (entries.get(path) === shared)
                        entries.delete(path);
                    shared.controller.abort();
                }, 0);
            }
        };
        const abort = () => { release(); reject(new DOMException("Aborted", "AbortError")); };
        signal?.addEventListener("abort", abort, { once: true });
        shared.promise.then((value) => { release(); resolve(value); }, (error) => { release(); reject(error); });
    });
}
export function invalidateAfterWrite(path) {
    if (path.startsWith("/auth/"))
        return invalidateReads();
    const root = path.split("/")[1];
    const stock = root === "orders" || (root === "warehouses" && path.endsWith("/stock"));
    const affected = stock ? ["products", "warehouse-stocks", "merchandising"]
        : root === "warehouses" ? ["warehouses", "products", "warehouse-stocks"]
            : root === "products" ? ["products", "combos", "merchandising", "warehouse-stocks"]
                : ["brands", "categories", "product-types", "hsn-codes", "attributes"].includes(root)
                    ? [root, "products", "combos", "merchandising"] : [root];
    invalidateReads((key) => affected.includes(key.split("/")[1]) || (stock && key.endsWith("/stock")));
}
