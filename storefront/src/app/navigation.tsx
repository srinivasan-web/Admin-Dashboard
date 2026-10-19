import {
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";

const eventName = "durafit:storefront-navigation";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(eventName, listener);
  };
}
export function useLocation() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
  );
}
export function navigate(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event(eventName));
}
export function Link({
  href = "/",
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      props.target ||
      props.download
    )
      return;
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || url.hash) return;
    event.preventDefault();
    navigate(url.pathname + url.search);
  }
  return <a {...props} href={href} onClick={handleClick} />;
}
