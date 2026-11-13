// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import { version } from "../package.json";
const catalog = JSON.parse(
  fs.readFileSync("public/catalog-index.json", "utf8"),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("loads only the lightweight release index while images can live on OSS", async () => {
  vi.stubEnv("BASE_URL", "/where-is-art/");
  vi.stubEnv("VITE_CONTENT_BASE_URL", "");
  vi.stubEnv("VITE_ASSET_BASE_URL", "https://assets.example/where-is-art/");
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => catalog });
  vi.stubGlobal("fetch", fetch);
  const { useContent } = await import("../src/infrastructure/useContent");
  const view = renderHook(() => useContent());
  await waitFor(() => expect(view.result.current.data).toBeDefined());
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    `/where-is-art/catalog-index.json?v=${version}`,
    expect.objectContaining({ cache: "no-cache" }),
  );
  expect(view.result.current.data?.artworks[0]).not.toHaveProperty("guide");
  expect(view.result.current.data?.images[0]).not.toHaveProperty("delivery");
});
