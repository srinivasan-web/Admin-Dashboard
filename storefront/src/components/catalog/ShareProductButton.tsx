import { useState } from "react";
import { Share2 } from "lucide-react";

export function ShareProductButton({ name }: { name: string }) {
  const [message, setMessage] = useState("");

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
        setMessage("Product shared.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMessage("Product link copied.");
      } else {
        setMessage("Copy this page's address to share it.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Sharing is unavailable. Copy this page's address instead.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-xs font-semibold text-navy transition-colors hover:border-accent hover:text-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Share2 size={16} aria-hidden="true" /> Share product
      </button>
      <span role="status" aria-live="polite" className="text-xs text-muted">
        {message}
      </span>
    </div>
  );
}
