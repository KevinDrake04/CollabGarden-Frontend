import { useState } from "react";
import { Search } from "lucide-react";
import { type County } from "../../../api/directory";

type CountyOption = {
  id: number;
  name: string;
};

function optionsFor(counties: County[], originalIds: number[]) {
  const options: CountyOption[] = counties.map((county) => ({
    id: county.county_id,
    name: county.name,
  }));
  for (const id of originalIds) {
    if (!options.some((option) => option.id === id)) {
      options.push({ id, name: `County ${id}` });
    }
  }
  return options;
}

export function BusinessCountyField({
  counties,
  selected,
  originalIds,
  error,
  disabled,
  onChange,
}: {
  counties: County[];
  selected: number[];
  originalIds: number[];
  error?: string;
  disabled: boolean;
  onChange: (countyIds: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const options = optionsFor(counties, originalIds);
  const query = search.trim().toLowerCase();
  const visible = options.filter((option) => option.name.toLowerCase().includes(query));
  const selectedNames = selected.map((id) => options.find((option) => option.id === id)?.name ?? `County ${id}`);

  function toggle(countyId: number) {
    onChange(
      selected.includes(countyId)
        ? selected.filter((id) => id !== countyId)
        : [...selected, countyId],
    );
  }

  return (
    <fieldset
      className="min-w-0 space-y-2"
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? "business-counties-error" : undefined}
      disabled={disabled}
    >
      <legend className="text-sm font-medium text-[var(--cg-text)]">Counties</legend>
      <p className="text-sm">
        {selectedNames.length === 0 ? "None selected." : selectedNames.join(", ")}
      </p>
      {counties.length === 0 && (
        <p className="text-xs text-[var(--cg-muted)]">Counties could not be loaded.</p>
      )}

      <div className="rounded-xl border border-[var(--cg-border)] bg-white">
        <div className="flex items-center gap-2 border-b border-[var(--cg-border)] px-3">
          <Search size={16} className="shrink-0 text-[var(--cg-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="Search counties"
            aria-label="Search counties"
            className="min-h-10 w-full min-w-0 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-2" aria-label="Select counties">
          {visible.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  checked
                    ? "bg-[var(--cg-background)] font-semibold text-[var(--cg-primary-dark)]"
                    : "text-[var(--cg-text)] hover:bg-[var(--cg-background)]"
                }`}
              >
                {option.name}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.id)}
                  className="size-4 accent-[var(--cg-primary)]"
                />
              </label>
            );
          })}
          {visible.length === 0 && (
            <p className="px-3 py-4 text-center text-sm">No counties found.</p>
          )}
        </div>
      </div>

      {error && (
        <p id="business-counties-error" role="alert" className="text-xs text-[var(--cg-error)]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
