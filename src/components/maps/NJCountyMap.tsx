import { useState } from "react";
import { NJ_COUNTY_PATHS, NJ_MAP_VIEWBOX } from "./countyPaths";
import "./NJCountyMap.css";

export type NJCountyMapProps = {
  selected: string[];
  onSelect: (countyName: string) => void;
};

function normalize(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

export function NJCountyMap({ selected, onSelect }: NJCountyMapProps) {
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [focusName, setFocusName] = useState<string | null>(null);
  const selectedKeys = new Set(selected.map(normalize));
  const selectedNames = NJ_COUNTY_PATHS
    .filter((county) => selectedKeys.has(normalize(county.name)))
    .map((county) => county.name);
  const shownName = hoverName ?? focusName ?? (selectedNames.length === 1 ? selectedNames[0] : null);
  const label = shownName
    ? `${shownName} County`
    : selectedNames.length > 1
      ? `${selectedNames.length} counties selected`
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
          onPointerLeave={() => setHoverName(null)}
          onFocus={(event) => {
            const name = event.target instanceof Element ? event.target.getAttribute("data-county") : null;
            if (name) setFocusName(name);
          }}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setFocusName(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const name = event.target instanceof Element ? event.target.getAttribute("data-county") : null;
            if (!name) return;
            event.preventDefault();
            onSelect(name);
          }}
        >
          {NJ_COUNTY_PATHS.map((county) => (
            <path
              key={county.geoid}
              d={county.d}
              data-county={county.name}
              className="nj-county"
              role="button"
              tabIndex={0}
              aria-pressed={selectedKeys.has(normalize(county.name))}
              aria-label={`${county.name} County`}
              fillRule="evenodd"
              strokeLinejoin="round"
              strokeLinecap="round"
              onClick={() => onSelect(county.name)}
              onPointerEnter={() => setHoverName(county.name)}
              onPointerDown={() => setHoverName(county.name)}
            >
              <title>{`${county.name} County`}</title>
            </path>
          ))}
        </svg>
      </div>
    </div>
  );
}
