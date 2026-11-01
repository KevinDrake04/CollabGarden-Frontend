import { useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

type CountyFilterProps = {
  options: string[];
  selected: string[];
  onChange: (counties: string[]) => void;
};

const optionStyle = [
  "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm",
  "text-[var(--cg-muted)] hover:bg-gray-100",
  "data-[selected=true]:bg-[var(--cg-background)]",
  "data-[selected=true]:font-semibold data-[selected=true]:text-[var(--cg-primary-dark)]",
].join(" ");

export default function CountyFilter({ options, selected, onChange }: CountyFilterProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState("");

  const matches = options.filter((county) =>
    county.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const label = selected.length === 0
    ? "All counties"
    : selected.length <= 2
      ? selected.join(", ")
      : `${selected.length} counties selected`;

  function toggleCounty(county: string) {
    onChange(
      selected.includes(county)
        ? selected.filter((item) => item !== county)
        : [...selected, county],
    );
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <span id="county-label" className="block text-sm font-medium">County</span>

      <details
        ref={menuRef}
        className="group relative"
        onToggle={(event) => {
          if (event.currentTarget.open) setSearch("");
        }}
      >
        <summary
          aria-labelledby="county-label county-value"
          className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[var(--cg-border)] bg-white px-3 py-2 text-sm shadow-sm [&::-webkit-details-marker]:hidden"
        >
          <span id="county-value" className="min-w-0 truncate">{label}</span>
          <ChevronDown size={16} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="absolute inset-x-0 z-20 mt-2 rounded-2xl border border-[var(--cg-border)] bg-white p-2 shadow-lg">
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--cg-border)] px-3">
            <Search size={16} className="shrink-0 text-[var(--cg-muted)]" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search counties"
              placeholder="Search counties..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-10 w-full min-w-0 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto" aria-label="Select counties">
            {!search.trim() && (
              <label className={optionStyle} data-selected={selected.length === 0}>
                All counties
                <input
                  type="checkbox"
                  checked={selected.length === 0}
                  onChange={() => onChange([])}
                  className="accent-[var(--cg-primary)]"
                />
              </label>
            )}

            {matches.map((county) => (
              <label
                key={county}
                className={optionStyle}
                data-selected={selected.includes(county)}
              >
                {county}
                <input
                  type="checkbox"
                  checked={selected.includes(county)}
                  onChange={() => toggleCounty(county)}
                  className="accent-[var(--cg-primary)]"
                />
              </label>
            ))}

            {matches.length === 0 && (
              <p className="p-4 text-center text-sm text-[var(--cg-muted)]">
                No counties found.
              </p>
            )}
          </div>

          <div className="mt-2 flex justify-end border-t border-[var(--cg-border)] pt-2">
            <button
              type="button"
              onClick={() => { if (menuRef.current) menuRef.current.open = false; }}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--cg-primary-dark)] hover:bg-[var(--cg-background)]"
            >
              Done
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
