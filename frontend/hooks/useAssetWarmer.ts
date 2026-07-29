import { useCallback, useRef } from "react";

// Assets do personagem principal — necessários em qualquer fase
const BOY_ASSET_URLS = [
  "/boy.png",
  ...Array.from({ length: 12 }, (_, i) => {
    const frame = String(i + 1).padStart(2, "0");
    return `/boy/walk_${frame}.png`;
  }),
];

export function useAssetWarmer() {
  const cachedUrls = useRef(new Set<string>());

  const warmSingleAsset = useCallback(async (url: string) => {
    try {
      await fetch(url, { cache: "force-cache" });
    } catch {
      // Mesmo com falha no fetch, tentamos carregar via Image para aquecer cache/decoder.
    }

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (img.decode) {
          img
            .decode()
            .catch(() => undefined)
            .finally(() => resolve());
          return;
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }, []);

  // Aquece os assets do Boy + os assets extras da fase detectada.
  // URLs já aquecidas são ignoradas para não repetir trabalho.
  const warmAssets = useCallback(
    async (extraUrls: string[] = []) => {
      const urls = [...BOY_ASSET_URLS, ...extraUrls];
      const uncached = urls.filter((url) => !cachedUrls.current.has(url));
      if (uncached.length === 0) return;

      await Promise.allSettled(uncached.map(warmSingleAsset));
      uncached.forEach((url) => cachedUrls.current.add(url));
    },
    [warmSingleAsset],
  );

  return { warmAssets };
}
