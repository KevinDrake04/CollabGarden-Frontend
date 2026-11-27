export function isPublicHttpUrl(value: string) {
  if (!/^https?:\/\/\S+$/.test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname && !url.username && !url.password);
  } catch {
    return false;
  }
}
