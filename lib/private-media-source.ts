import { resolvePrivateMediaUri } from "@/lib/private-storage";

export const hasRemoteImageSource = (source: unknown): boolean => {
  if (typeof source === "string") return /^https?:\/\//i.test(source);
  if (Array.isArray(source)) return source.some(hasRemoteImageSource);
  return Boolean(source && typeof source === "object" && "uri" in source &&
    typeof source.uri === "string" && /^https?:\/\//i.test(source.uri));
};

export const resolvePrivateImageSource = async <T>(source: T): Promise<T> => {
  if (typeof source === "string") return await resolvePrivateMediaUri(source) as T;
  if (Array.isArray(source)) return await Promise.all(source.map(resolvePrivateImageSource)) as T;
  if (source && typeof source === "object" && "uri" in source && typeof source.uri === "string") {
    return { ...source, uri: await resolvePrivateMediaUri(source.uri) };
  }
  return source;
};
