import { useEffect, useState } from "react";
import { assetUrl } from "../domain/atlas";
import type {
  AtlasData,
  ArtworkImages,
  Catalog,
  CollectionRegistry,
  WorldMap,
} from "../types";

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(assetUrl(path), {
    signal,
  });
  if (!response.ok) throw new Error(`无法读取 ${path}（${response.status}）`);
  return response.json() as Promise<T>;
}

export function useAtlasData() {
  const [data, setData] = useState<AtlasData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      readJson<Catalog>("data.json", controller.signal),
      readJson<ArtworkImages>("assets/images.json", controller.signal),
      readJson<WorldMap>("assets/world.geo.json", controller.signal),
      readJson<CollectionRegistry>("collections.json", controller.signal),
    ])
      .then(([catalog, images, world, registry]) => {
        if (!controller.signal.aborted)
          setData({
            ...catalog,
            // Legacy components consume image.path directly; source URLs stay intact.
            images: Object.fromEntries(
              Object.entries(images).map(([id, image]) => [
                id,
                { ...image, path: assetUrl(image.path) },
              ]),
            ),
            world,
            registry,
          });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "资料读取失败");
      });
    return () => controller.abort();
  }, []);

  return { data, error };
}
