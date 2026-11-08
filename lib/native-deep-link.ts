/**
 * Bounds work performed on untrusted Android system links before Expo Router
 * dispatches them. This is a mitigation while the SDK 55 query-string and
 * decode-uri-component dependency chain remains on a vulnerable release.
 */
export const MAX_NATIVE_LINK_LENGTH = 4096;
export const MAX_NATIVE_QUERY_LENGTH = 2048;
export const MAX_NATIVE_QUERY_FIELDS = 64;
export const MAX_NATIVE_PERCENT_ESCAPES = 96;

export function sanitizeIncomingNativePath(path: unknown): string {
  if (typeof path !== "string" || !path || path.length > MAX_NATIVE_LINK_LENGTH) {
    return "/";
  }

  // Limit percent-encoded runs before any decoder or router work.
  // Malformed streams of repeated encodings are a known DoS input.
  let percentEscapes = 0;
  for (const char of path) {
    if (char === "%") {
      percentEscapes += 1;
      if (percentEscapes > MAX_NATIVE_PERCENT_ESCAPES) {
        return "/";
      }
    }
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return "/";
  }

  if (/[\u0000-\u001f\u007f]/.test(decoded)) {
    return "/";
  }

  const queryStart = path.indexOf("?");
  if (queryStart !== -1) {
    const hashStart = path.indexOf("#", queryStart);
    const query = path.slice(
      queryStart + 1,
      hashStart === -1 ? path.length : hashStart
    );
    if (
      query.length > MAX_NATIVE_QUERY_LENGTH ||
      query.split("&").length > MAX_NATIVE_QUERY_FIELDS
    ) {
      return "/";
    }
  }

  return path;
}
