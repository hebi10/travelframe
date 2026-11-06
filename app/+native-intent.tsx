import { sanitizeIncomingNativePath } from "@/lib/native-deep-link";

/**
 * Expo Router handles external Android links here before route matching.
 * Reject malformed/oversized paths rather than passing them to the older
 * query-string decoding dependency.
 */
export function redirectSystemPath({ path }: { initial: boolean; path: string }): string {
  return sanitizeIncomingNativePath(path);
}
