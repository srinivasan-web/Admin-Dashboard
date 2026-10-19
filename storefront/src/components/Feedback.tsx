import { ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "../app/navigation";

export function LoadingState({
  label = "Loading products…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-line" />
      {label}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="feedback error" role="alert">
      <p>{error.message}</p>
      <button className="button secondary" onClick={retry}>
        <RefreshCw size={16} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="feedback">
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="text-link" href="/products">
        Explore all equipment <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
