import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import { forwardRef, useEffect, useState } from "react";
import { Image as NativeImage, type ImageProps as NativeImageProps } from "react-native";

import { useAuth } from "@/lib/auth-context";
import { hasRemoteImageSource, resolvePrivateImageSource } from "@/lib/private-media-source";
import { resolvePrivateMediaUri } from "@/lib/private-storage";

const usePrivateImageSource = <T,>(source: T): T | undefined => {
  const { user } = useAuth();
  const remote = hasRemoteImageSource(source);
  const key = remote ? JSON.stringify([user?.uid ?? null, source]) : "";
  const [resolved, setResolved] = useState<{ key: string; source: T } | null>(null);
  useEffect(() => {
    if (!remote) return;
    let cancelled = false;
    const currentSource = source;
    void resolvePrivateImageSource(currentSource).then((value) => {
      if (!cancelled) setResolved({ key, source: value });
    }).catch(() => {
      if (!cancelled) setResolved(null);
    });
    return () => { cancelled = true; };
    // key includes the complete source and UID; object identity may change on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, remote]);
  if (!remote) return source;
  return resolved?.key === key ? resolved.source : undefined;
};

const PrivateExpoImage = forwardRef<ExpoImage, ExpoImageProps>((props, ref) => {
  const source = usePrivateImageSource(props.source);
  return <ExpoImage {...props} ref={ref} source={source} />;
});
PrivateExpoImage.displayName = "PrivateImage";

export const Image = Object.assign(PrivateExpoImage, {
  prefetch: async (urls: string | string[], options?: "memory" | "disk" | "memory-disk" | Parameters<typeof ExpoImage.prefetch>[1]) => {
    const resolved = await Promise.all((Array.isArray(urls) ? urls : [urls]).map(resolvePrivateMediaUri));
    return ExpoImage.prefetch(resolved, typeof options === "string" ? { cachePolicy: options } : options);
  },
  loadAsync: async (...args: Parameters<typeof ExpoImage.loadAsync>) => {
    const [source, ...options] = args;
    return ExpoImage.loadAsync(await resolvePrivateImageSource(source), ...options);
  }
});

export const PrivateNativeImage = forwardRef<NativeImage, NativeImageProps>((props, ref) => {
  const source = usePrivateImageSource(props.source);
  return <NativeImage {...props} ref={ref} source={source} />;
});
PrivateNativeImage.displayName = "PrivateNativeImage";
