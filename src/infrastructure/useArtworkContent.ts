import { useEffect, useState } from "react";
import { artworkContentUrl } from "./contentDelivery";
import {
  artworkContentSchema,
  primaryImage,
  validateRelations,
  type ArtworkContent,
  type CatalogIndex,
} from "../domain/atlas";

const cache = new Map<string, ArtworkContent>();
const pending = new Map<string, Promise<ArtworkContent>>();
const CACHE_LIMIT = 40;

function load(index: CatalogIndex, id: string, key: string) {
  const found = cache.get(key);
  if (found) {
    cache.delete(key);
    cache.set(key, found);
    return Promise.resolve(found);
  }
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const request = fetch(key, {
    signal: AbortSignal.timeout(20_000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("作品资料暂时无法加载");
      const content = artworkContentSchema.parse(await response.json());
      const summary = index.artworks.find((work) => work.id === id)!;
      const errors = validateRelations({
        ...index,
        artworks: [content.work],
        images: content.images,
        venues: [],
        holdings: [],
        topics: [],
      });
      if (
        content.work.id !== id ||
        errors.length ||
        content.work.title !== summary.title ||
        content.work.imageStatus !== summary.imageStatus ||
        JSON.stringify(content.work.artistIds) !==
          JSON.stringify(summary.artistIds) ||
        primaryImage(content, id)?.id !== primaryImage(index, id)?.id
      )
        throw new Error("作品资料与目录不一致");
      cache.set(key, content);
      if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      return content;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function useArtworkContent(
  index: CatalogIndex | undefined,
  id: string | undefined,
) {
  const known = id && index?.artworks.some((work) => work.id === id);
  const key = known && index && id ? artworkContentUrl(index, id) : undefined;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key?: string;
    data?: ArtworkContent;
    error?: string;
  }>({});
  useEffect(() => {
    if (!key || !index || !id) return;
    let active = true;
    setState({ key, data: cache.get(key) });
    load(index, id, key)
      .then((data) => {
        if (active) setState({ key, data });
      })
      .catch(() => {
        if (active) setState({ key, error: "暂时未能读取作品资料，请重试。" });
      });
    return () => {
      active = false;
    };
  }, [index, id, key, attempt]);
  // A result for a previous route must never be rendered for the current work.
  const current = key && state.key === key ? state : undefined;
  const data = current?.data ?? (key ? cache.get(key) : undefined);
  return {
    data,
    error: current?.error ?? "",
    loading: Boolean(key && !data && !current?.error),
    retry: () => setAttempt((n) => n + 1),
  };
}
