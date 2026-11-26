const maxImageBytes = 5 * 1024 * 1024;

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

async function imageKind(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes.length >= 12
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return "";
}

export async function profileImageProblem(file: File) {
  if (file.size <= 0) return "Choose an image file.";
  if (file.size > maxImageBytes) return "Use an image that is 5 MB or smaller.";
  const kind = await imageKind(file);
  if (!kind) return "Use a JPG, PNG, or WebP image.";
  return "";
}
