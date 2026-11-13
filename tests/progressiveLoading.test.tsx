// @vitest-environment jsdom
import fs from "node:fs";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { catalogIndexSchema, type ArtworkContent } from "../src/domain/atlas";

const index = catalogIndexSchema.parse(
  JSON.parse(fs.readFileSync("public/catalog-index.json", "utf8")),
);
const readWork = (id: string): ArtworkContent =>
  JSON.parse(fs.readFileSync(`public/${index.detailBase}${id}.json`, "utf8"));
const response = (data: unknown) => ({ ok: true, json: async () => data });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubEnv("BASE_URL", "/where-is-art/");
  vi.stubEnv("VITE_CONTENT_BASE_URL", "");
  vi.stubEnv("VITE_ASSET_BASE_URL", "https://assets.example/where-is-art/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("does not request details while browsing and deduplicates concurrent index consumers", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(index));
  vi.stubGlobal("fetch", fetcher);
  const { useContent } = await import("../src/infrastructure/useContent");
  const { useArtworkContent } =
    await import("../src/infrastructure/useArtworkContent");
  const first = renderHook(() => {
    const state = useContent();
    useArtworkContent(state.data, undefined);
    return state;
  });
  const second = renderHook(() => useContent());
  await waitFor(() => expect(first.result.current.data).toBeDefined());
  await waitFor(() => expect(second.result.current.data).toBeDefined());
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("loads only the selected work and reuses it when opening the viewer or returning", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(readWork("mona")));
  vi.stubGlobal("fetch", fetcher);
  const { useArtworkContent } =
    await import("../src/infrastructure/useArtworkContent");
  const first = renderHook(({ id }) => useArtworkContent(index, id), {
    initialProps: { id: "mona" as string | undefined },
  });
  const concurrent = renderHook(() => useArtworkContent(index, "mona"));
  await waitFor(() => expect(first.result.current.data?.work.id).toBe("mona"));
  await waitFor(() =>
    expect(concurrent.result.current.data?.work.id).toBe("mona"),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    `/where-is-art/${index.detailBase}mona.json`,
    expect.any(Object),
  );
  first.rerender({ id: undefined });
  expect(first.result.current.data).toBeUndefined();
  first.rerender({ id: "mona" });
  expect(first.result.current.data?.work.guide).toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("ignores late results from an earlier work after switching routes", async () => {
  const old = deferred<ReturnType<typeof response>>();
  const next = deferred<ReturnType<typeof response>>();
  const fetcher = vi
    .fn()
    .mockImplementation((url: string) =>
      url.endsWith("mona.json") ? old.promise : next.promise,
    );
  vi.stubGlobal("fetch", fetcher);
  const { useArtworkContent } =
    await import("../src/infrastructure/useArtworkContent");
  const view = renderHook(({ id }) => useArtworkContent(index, id), {
    initialProps: { id: "mona" },
  });
  view.rerender({ id: "ermine" });
  expect(view.result.current.data).toBeUndefined();
  await act(async () => old.resolve(response(readWork("mona"))));
  expect(view.result.current.data).toBeUndefined();
  await act(async () => next.resolve(response(readWork("ermine"))));
  expect(view.result.current.data?.work.id).toBe("ermine");
});

it("retries a failed detail request without reloading the catalog", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(response(readWork("mona")));
  vi.stubGlobal("fetch", fetcher);
  const { useArtworkContent } =
    await import("../src/infrastructure/useArtworkContent");
  const view = renderHook(() => useArtworkContent(index, "mona"));
  await waitFor(() => expect(view.result.current.error).not.toBe(""));
  expect(view.result.current.data).toBeUndefined();
  act(() => view.result.current.retry());
  await waitFor(() => expect(view.result.current.data?.work.id).toBe("mona"));
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("rejects another artwork's response and never fetches unknown IDs", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(readWork("ermine")));
  vi.stubGlobal("fetch", fetcher);
  const { useArtworkContent } =
    await import("../src/infrastructure/useArtworkContent");
  const view = renderHook(({ id }) => useArtworkContent(index, id), {
    initialProps: { id: "missing-work" },
  });
  expect(fetcher).not.toHaveBeenCalled();
  view.rerender({ id: "mona" });
  await waitFor(() => expect(view.result.current.error).not.toBe(""));
  expect(view.result.current.data).toBeUndefined();
});

it("keeps missing-image details readable and all images of multipart works available", async () => {
  const missing = index.artworks.find(
    (work) => work.imageStatus === "unavailable",
  )!;
  const fetcher = vi
    .fn()
    .mockImplementation(async (url: string) =>
      response(
        readWork(decodeURIComponent(url.split("/").at(-1)!.slice(0, -5))),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const { useArtworkContent } =
    await import("../src/infrastructure/useArtworkContent");
  const view = renderHook(({ id }) => useArtworkContent(index, id), {
    initialProps: { id: missing.id },
  });
  await waitFor(() =>
    expect(view.result.current.data?.work.id).toBe(missing.id),
  );
  expect(view.result.current.data?.images).toEqual([]);
  view.rerender({ id: "tang-yin-11" });
  await waitFor(() =>
    expect(view.result.current.data?.work.id).toBe("tang-yin-11"),
  );
  expect(
    view.result.current.data?.images.filter((image) => image.role === "detail"),
  ).toHaveLength(12);
});

it("retries an unavailable catalog before loading any details", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(response(index));
  vi.stubGlobal("fetch", fetcher);
  const { useContent } = await import("../src/infrastructure/useContent");
  const view = renderHook(() => useContent());
  await waitFor(() => expect(view.result.current.error).not.toBe(""));
  act(() => view.result.current.retry());
  await waitFor(() => expect(view.result.current.data).toBeDefined());
  expect(fetcher).toHaveBeenCalledTimes(2);
});
