// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAtlasData } from "../src/hooks/useAtlasData";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("resolves legacy JSON and image paths without changing source links", async () => {
  const base = "https://assets.example/where-is-art/";
  vi.stubEnv("VITE_ASSET_BASE_URL", base);
  vi.stubEnv("BASE_URL", "/different-app/");
  const image = {
    path: "assets/mona.jpg",
    source: "https://museum.example/work",
    url: "https://museum.example/original.jpg",
  };
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(url.endsWith("images.json") ? { mona: image } : {}),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(useAtlasData);
  await waitFor(() => expect(result.current.data).not.toBeNull());
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
    [
      "data.json",
      "assets/images.json",
      "assets/world.geo.json",
      "collections.json",
    ].map((path) => base + path),
  );
  expect(result.current.data!.images.mona).toEqual({
    ...image,
    path: base + image.path,
  });
});
