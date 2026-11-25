import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import { countyDiscoverPath, NJ_COUNTY_NAMES } from "../maps/countyPaths";

type CountiesMenuProps = {
  variant?: "dropdown" | "inline";
  onNavigate?: () => void;
};

export function CountiesMenu({ variant = "dropdown", onNavigate }: CountiesMenuProps) {
  const { pathname, search } = useLocation();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = new Set(new URLSearchParams(search).getAll("county"));
  const onDiscover = pathname === "/discover";

  useEffect(() => {
    setOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function countyHref(name: string) {
    if (pathname !== "/discover") return countyDiscoverPath(name);
    const params = new URLSearchParams(search);
    params.delete("county");
    params.set("county", name);
    const query = params.toString();
    return query ? `/discover?${query}` : "/discover";
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm cg-focus ${
          variant === "inline" ? "w-full justify-between" : ""
        } ${
          open
            ? "bg-[var(--cg-background)] text-[var(--cg-primary-dark)]"
            : "text-[var(--cg-muted)] hover:bg-[var(--cg-background)]"
        }`}
        aria-expanded={open}
        aria-controls={menuId}
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
          className={
            variant === "dropdown"
              ? "absolute top-full left-0 z-40 mt-1 max-h-80 w-56 overflow-y-auto rounded-2xl border border-[var(--cg-border)] bg-white p-1 shadow-lg"
              : "mt-1 max-h-80 overflow-y-auto rounded-xl border border-[var(--cg-border)] bg-white p-1"
          }
        >
          {NJ_COUNTY_NAMES.map((name) => {
            const current = onDiscover && selected.has(name);
            return (
              <Link
                key={name}
                to={countyHref(name)}
                aria-current={current ? "page" : undefined}
                onClick={() => {
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
