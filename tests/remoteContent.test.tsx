// @vitest-environment jsdom
import fs from "node:fs";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const index = JSON.parse(fs.readFileSync("public/catalog-index.json", "utf8"));
const revision = index.detailBase.split("/")[1];
const base = "https://assets.example/where-is-art/content/";
const release = `${base}releases/${revision}/`;
const pointer = {
  schemaVersion: 1,
  revision,
  index: `releases/${revision}/catalog-index.json`,
};
const response = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => {
  vi.stubEnv("BASE_URL", "/where-is-art/");
  vi.stubEnv("VITE_CONTENT_BASE_URL", base.slice(0, -1));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("loads the remote pointer and index, then only the selected detail in that pinned release", async () => {
  const detail = JSON.parse(
    fs.readFileSync(`public/${index.detailBase}mona.json`, "utf8"),
  );
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(pointer))
    .mockResolvedValueOnce(response(index))
    .mockResolvedValueOnce(response(detail));
  vi.stubGlobal("fetch", fetcher);
  const { useContent } = await import("../src/infrastructure/useContent");
  const { useArtworkContent } =
    await import("../src/infrastructure/useArtworkContent");
  const view = renderHook(
    ({ id }) => {
      const catalog = useContent();
      return { catalog, detail: useArtworkContent(catalog.data, id) };
    },
    { initialProps: { id: undefined as string | undefined } },
  );
  await waitFor(() => expect(view.result.current.catalog.data).toBeDefined());
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    `${base}current.json`,
    `${release}catalog-index.json`,
  ]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-cache" });
  view.rerender({ id: "mona" });
  await waitFor(() =>
    expect(view.result.current.detail.data?.work.id).toBe("mona"),
  );
  expect(fetcher.mock.calls[2][0]).toBe(
    `${release}${index.detailBase}mona.json`,
  );
  const second = renderHook(() => useContent());
  await waitFor(() => expect(second.result.current.data).toBeDefined());
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(view.result.current.catalog.data?.contentBase).toBe(release);
});

it.each([
  { ...pointer, schemaVersion: 2 },
  { ...pointer, index: "https://unrelated.example/catalog.json" },
  { ...pointer, index: `releases/${revision}/../catalog-index.json` },
])(
  "rejects unsupported or redirected release pointers before loading an index: %j",
  async (invalid) => {
    const fetcher = vi.fn().mockResolvedValue(response(invalid));
    vi.stubGlobal("fetch", fetcher);
    const { loadCatalog } =
      await import("../src/infrastructure/contentDelivery");
    await expect(loadCatalog()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it("rejects an index whose details belong to another revision", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(response(pointer))
      .mockResolvedValueOnce(
        response({
          ...index,
          detailBase: "artwork-details/00000000000000000000/",
        }),
      ),
  );
  const { loadCatalog } = await import("../src/infrastructure/contentDelivery");
  await expect(loadCatalog()).rejects.toThrow("内容数据校验未通过");
});

it("does not cache a failed index, and retries the pointer to recover a newly published version", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(pointer))
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(response(pointer))
    .mockResolvedValueOnce(response(index));
  vi.stubGlobal("fetch", fetcher);
  const { loadCatalog } = await import("../src/infrastructure/contentDelivery");
  await expect(loadCatalog()).rejects.toThrow();
  await expect(loadCatalog()).resolves.toMatchObject({ contentBase: release });
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    `${base}current.json`,
    `${release}catalog-index.json`,
    `${base}current.json`,
    `${release}catalog-index.json`,
  ]);
});
