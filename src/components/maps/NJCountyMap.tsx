import { useState } from "react";
import { NJ_COUNTY_PATHS, NJ_MAP_VIEWBOX } from "./countyPaths";
import "./NJCountyMap.css";

type NJCountyMapProps = {
  selected: string[];
  onSelect: (countyName: string) => void;
};

export function NJCountyMap({ selected, onSelect }: NJCountyMapProps) {
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [focusName, setFocusName] = useState<string | null>(null);
  const shownName = hoverName ?? focusName ?? (selected.length === 1 ? selected[0] : null);
  const label = shownName
    ? `${shownName} County`
    : selected.length > 1
      ? `${selected.length} counties selected`
      : "Select a county";

  return (
    <div className="nj-county-map w-full">
      <p className="mb-3 min-h-6 text-center text-sm font-semibold text-[var(--cg-primary-dark)]">
        {label}
      </p>
      <div className="rounded-2xl bg-[var(--cg-background)] p-2 sm:p-3">
        <svg
          viewBox={NJ_MAP_VIEWBOX}
          role="group"
          aria-label="New Jersey counties"
          className="block h-auto w-full"
        >
          {NJ_COUNTY_PATHS.map((county) => (
            <path
              key={county.geoid}
              d={county.d}
              className="nj-county"
              role="button"
              tabIndex={0}
              aria-pressed={selected.includes(county.name)}
              aria-label={`${county.name} County`}
              fillRule="evenodd"
              strokeLinejoin="round"
              strokeLinecap="round"
              onClick={() => onSelect(county.name)}
              onPointerEnter={() => setHoverName(county.name)}
              onPointerLeave={() => setHoverName(null)}
              onFocus={() => setFocusName(county.name)}
              onBlur={() => setFocusName(null)}
              onKeyDown={(event) => {
                if (event.key === " ") event.preventDefault();
                if (event.key === "Enter" && !event.repeat) onSelect(county.name);
              }}
              onKeyUp={(event) => {
                if (event.key === " ") onSelect(county.name);
              }}
            >
              <title>{`${county.name} County`}</title>
            </path>
          ))}
        </svg>
      </div>
    </div>
  );
}
