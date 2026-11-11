// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import catalog from "../public/catalog.json";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("loads the catalog shipped with the app while images can live on OSS", async () => {
  vi.stubEnv("BASE_URL", "/where-is-art/");
  vi.stubEnv("VITE_ASSET_BASE_URL", "https://assets.example/where-is-art/");
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => catalog });
  vi.stubGlobal("fetch", fetch);
  const { useContent } = await import("../src/infrastructure/useContent");
  const view = renderHook(() => useContent());
  await waitFor(() => expect(view.result.current.data).toBeDefined());
  expect(fetch).toHaveBeenCalledWith("/where-is-art/catalog.json");
});
