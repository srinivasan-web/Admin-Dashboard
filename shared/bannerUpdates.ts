const channelName = "durafit:banner-updates";
const storageKey = "durafit:banner-revision";
type Notice = { type: "banners.changed"; id: string };

/** Publish an invalidation signal only; the public API remains authoritative. */
export function publishBannerUpdate() {
  const notice: Notice = {
    type: "banners.changed",
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  window.dispatchEvent(new CustomEvent(channelName, { detail: notice }));
  try {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(notice);
    channel.close();
  } catch {
    /* Visibility/polling revalidation remains available. */
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(notice));
  } catch {
    /* Storage may be disabled. */
  }
}

export function subscribeBannerUpdates(listener: () => void) {
  let lastId = "";
  function receive(value: unknown) {
    if (!value || typeof value !== "object") return;
    const notice = value as Partial<Notice>;
    if (
      notice.type !== "banners.changed" ||
      typeof notice.id !== "string" ||
      notice.id.length > 100 ||
      notice.id === lastId
    )
      return;
    lastId = notice.id;
    listener();
  }
  const local = (event: Event) => receive((event as CustomEvent).detail);
  const storage = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      /* Ignore unrelated/invalid messages. */
    }
  };
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (event) => receive(event.data);
  } catch {
    /* Use storage and refresh events. */
  }
  window.addEventListener(channelName, local);
  window.addEventListener("storage", storage);
  return () => {
    channel?.close();
    window.removeEventListener(channelName, local);
    window.removeEventListener("storage", storage);
  };
}
