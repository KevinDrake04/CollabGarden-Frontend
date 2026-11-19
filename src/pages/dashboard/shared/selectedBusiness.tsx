import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { AppSelect } from "../../../components";
import { getBusinesses } from "../../../api/campaigns";

const selectionKey = "collabgarden.selectedBusiness";

export function readRememberedBusiness(userId: string, ids: number[]) {
  try {
    const raw = sessionStorage.getItem(selectionKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: unknown; businessId?: unknown };
    if (parsed.userId !== userId || typeof parsed.businessId !== "number") return null;
    return ids.includes(parsed.businessId) ? parsed.businessId : null;
  } catch {
    return null;
  }
}

export function rememberBusiness(userId: string, businessId: number) {
  sessionStorage.setItem(selectionKey, JSON.stringify({ userId, businessId }));
}

export function resolvedBusinessId(
  raw: string | null,
  ids: number[],
  fallbacks: Array<number | null>,
) {
  if (raw) {
    const requested = Number(raw);
    if (ids.includes(requested)) return requested;
  }
  for (const id of fallbacks) {
    if (id != null && ids.includes(id)) return id;
  }
  return ids[0] ?? null;
}

export function businessSearch(id: number | null) {
  return id == null ? "" : `?business=${id}`;
}

// Keeps a verified business id in ?business= and in this browser for the signed-in user.
export function useSelectedBusiness(
  userId: string | null,
  ids: number[],
  preferred: number | null,
  enabled = true,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const remembered = enabled && userId ? readRememberedBusiness(userId, ids) : null;
  const selected = enabled
    ? resolvedBusinessId(searchParams.get("business"), ids, [remembered, preferred])
    : null;

  useEffect(() => {
    if (!enabled || selected == null || !userId) return;
    rememberBusiness(userId, selected);
    if (searchParams.get("business") === String(selected)) return;
    const next = new URLSearchParams(searchParams);
    next.set("business", String(selected));
    setSearchParams(next, { replace: true });
  }, [enabled, selected, searchParams, setSearchParams, userId]);

  function choose(id: number) {
    if (!userId || !ids.includes(id)) return;
    rememberBusiness(userId, id);
    const next = new URLSearchParams(searchParams);
    next.set("business", String(id));
    setSearchParams(next);
  }

  return { selected, choose };
}

export function useBusinessNames(ids: number[]) {
  const key = ids.join(",");
  const [names, setNames] = useState<Map<number, string>>(() => new Map());

  useEffect(() => {
    if (!key) {
      setNames(new Map());
      return;
    }
    const allowed = key.split(",").map(Number);
    const controller = new AbortController();
    getBusinesses(controller.signal)
      .then((businesses) => {
        if (controller.signal.aborted) return;
        const next = new Map<number, string>();
        for (const business of businesses) {
          if (allowed.includes(business.business_id) && business.name.trim()) {
            next.set(business.business_id, business.name.trim());
          }
        }
        setNames(next);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
        setNames(new Map());
      });
    return () => controller.abort();
  }, [key]);

  return names;
}

export function BusinessSwitcher({
  ids,
  names,
  selected,
  onChange,
}: {
  ids: number[];
  names: Map<number, string>;
  selected: number | null;
  onChange: (id: number) => void;
}) {
  if (ids.length < 2) return null;
  return (
    <div className="max-w-md">
      <AppSelect
        label="Business"
        name="dashboard-business"
        value={selected == null ? "" : String(selected)}
        onChange={(value) => {
          const id = Number(value);
          if (ids.includes(id)) onChange(id);
        }}
        options={ids.map((id) => ({
          value: String(id),
          label: names.get(id) ?? `Business ${id}`,
        }))}
        placeholder="Select a business"
      />
    </div>
  );
}
