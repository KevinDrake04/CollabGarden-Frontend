export class ProfileRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export class UnconfirmedProfileWrite extends ProfileRequestError {
  constructor(message: string, readonly check: () => Promise<void>) {
    super(409, message);
  }
}

export type ProfileSave<T> = {
  saved: T;
  error?: ProfileRequestError;
  check?: () => Promise<ProfileSave<T> | undefined>;
};

export async function profileSaveResult<T>(save: () => Promise<void>, snapshot: () => T): Promise<ProfileSave<T>> {
  try {
    await save();
    return { saved: snapshot() };
  } catch (error) {
    if (!(error instanceof ProfileRequestError)) throw error;
    if (error instanceof UnconfirmedProfileWrite) {
      return { saved: snapshot(), error, check: () => profileSaveResult(error.check, snapshot) };
    }
    return { saved: snapshot(), error };
  }
}

function isAcknowledged({ status }: ProfileRequestError) {
  return status >= 200 && status < 300;
}

function uncertainWrite(error: ProfileRequestError) {
  return error.status === 0 || error.status >= 500 || isAcknowledged(error);
}

export async function confirmProfileWrite(
  write: () => Promise<void>,
  readBack: (acknowledged: boolean) => Promise<boolean>,
  label: string,
  { checkLater = false, checkNotFound = false } = {},
) {
  async function check(problem: ProfileRequestError): Promise<void> {
    let confirmed: boolean;
    try {
      confirmed = await readBack(isAcknowledged(problem));
    } catch (error) {
      if (error instanceof ProfileRequestError && (error.status === 401 || error.status === 403)) throw error;
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new UnconfirmedProfileWrite(`Could not check whether ${label} was saved. Check saved changes before retrying.`, () => check(problem));
    }
    if (!confirmed) {
      throw new ProfileRequestError(409, `${problem.message} Could not confirm that ${label} was saved. Review your changes before retrying.`);
    }
  }

  try {
    await write();
  } catch (error) {
    if (!(error instanceof ProfileRequestError) || (!uncertainWrite(error) && !(checkNotFound && error.status === 404))) {
      throw error;
    }
    if (checkLater && !isAcknowledged(error)) {
      throw new UnconfirmedProfileWrite(`Could not confirm whether ${label} was saved. Check saved changes before retrying.`, () => check(error));
    }
    await check(error);
  }
}

function apiUrl() {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!url) throw new Error("Missing VITE_API_URL in .env.local");
  return url;
}

export function profileRecord(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  throw new ProfileRequestError(200, "The profile response was incomplete.");
}

export function completeProfileRecord(body: unknown, fields: object) {
  const record = profileRecord(body);
  if (Object.keys(fields).some((key) => !Object.hasOwn(record, key))) {
    throw new ProfileRequestError(200, "The profile response was incomplete.");
  }
  return record;
}

export function profileText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

export function profileId(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function profileImageUrl(value: unknown) {
  const path = profileText(value);
  if (!path || path.length > 2000) return null;
  try {
    const url = path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
      ? new URL(path, apiUrl()) : new URL(path);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}

export function sameSelection<T>(left: readonly T[], right: readonly T[]) {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
}

function errorDetail(body: unknown) {
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail.map((item: { msg?: unknown } | null) => profileText(item?.msg)).filter(Boolean).join(" ");
  }
  return "";
}

export async function profileRequest(path: string, token: string, init: RequestInit = {}) {
  const url = `${apiUrl()}${path}`;
  const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}` });
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ProfileRequestError(0, "The profile service could not be reached.");
  }

  if (response.status === 204) return null;
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body;
  throw new ProfileRequestError(response.status, errorDetail(body) || `API request failed: ${response.status}`);
}
