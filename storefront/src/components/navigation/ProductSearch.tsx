import { useEffect, useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { navigate } from "../../app/navigation";

export function ProductSearch({
  id,
  location,
  onNavigate,
}: {
  id: string;
  location: string;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(new URLSearchParams(location.split("?")[1]).get("q") ?? "");
  }, [location]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    onNavigate?.();
  }

  return (
    <form className="nav-search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>
        Search equipment
      </label>
      <input
        id={id}
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={100}
        placeholder="Search treadmills, walking pads, bikes…"
      />
      {query && (
        <button
          className="nav-search-clear"
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery("")}
        >
          <X size={17} aria-hidden="true" />
        </button>
      )}
      <button
        className="nav-search-submit"
        type="submit"
        aria-label="Search equipment"
      >
        <Search size={20} aria-hidden="true" />
      </button>
    </form>
  );
}
