import { useEffect, useId, useRef, useState } from "react";
import { Link, matchPath, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import { countyDiscoverPath, NJ_COUNTY_NAMES, readCountyParams } from "../maps/countyPaths";

type CountiesMenuProps = {
  variant?: "dropdown" | "inline";
  onNavigate?: () => void;
};

export function CountiesMenu({ variant = "dropdown", onNavigate }: CountiesMenuProps) {
  const { pathname, search, hash } = useLocation();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const desktop = variant === "dropdown";
  const onDiscover = Boolean(matchPath("/discover", pathname));
  const discoverSearch = onDiscover ? search : "";
  const discoverHash = onDiscover ? hash : "";
  const selected = open ? readCountyParams(new URLSearchParams(discoverSearch)) : [];

  useEffect(() => {
    if (desktop) setOpen(false);
  }, [desktop, pathname, search]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm cg-focus ${
          desktop ? "" : "w-full justify-between"
        } ${
          open
            ? "bg-[var(--cg-background)] text-[var(--cg-primary-dark)]"
            : "text-[var(--cg-muted)] hover:bg-[var(--cg-background)]"
        }`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        Counties
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          id={menuId}
          className={`mt-1 max-h-80 overflow-y-auto border border-[var(--cg-border)] bg-white p-1 ${
            desktop ? "absolute top-full left-0 z-40 w-56 rounded-2xl shadow-lg" : "rounded-xl"
          }`}
        >
          {NJ_COUNTY_NAMES.map((name) => {
            const current = selected.includes(name);
            return (
              <Link
                key={name}
                to={countyDiscoverPath(name, discoverSearch, discoverHash)}
                state={{ focusDirectoryHeading: true }}
                aria-current={current ? "page" : undefined}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  setOpen(false);
                  onNavigate?.();
                }}
                className={`block rounded-lg px-3 py-2.5 text-sm no-underline cg-focus ${
                  current
                    ? "bg-[var(--cg-background)] font-semibold text-[var(--cg-primary-dark)]"
                    : "text-[var(--cg-muted)] hover:bg-[var(--cg-background)] hover:text-[var(--cg-primary-dark)]"
                }`}
              >
                {name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
