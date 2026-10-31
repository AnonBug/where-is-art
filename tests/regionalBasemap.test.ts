import type { Map as LibreMap, StyleSpecification } from "maplibre-gl";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindRegionalBasemap,
  selectBasemap,
  type ViewBounds,
} from "../src/infrastructure/regionalBasemap";

const paris = { west: 2.2, south: 48.8, east: 2.5, north: 49 };
const china = { west: 73, south: 3, east: 136, north: 55 };
afterEach(() => vi.unstubAllGlobals());
describe("regional basemap policy", () => {
  it.each([
    ["mainland", china],
    ["Taiwan", { west: 119, south: 21, east: 123, north: 26 }],
    ["Hong Kong", { west: 113, south: 21, east: 115, north: 24 }],
    ["eastern Himalaya", { west: 89, south: 25, east: 98, north: 31 }],
    ["South China Sea", { west: 104, south: 3, east: 124, north: 24 }],
    [
      "partially intersecting viewport",
      { west: 40, south: 10, east: 75, north: 40 },
    ],
    ["wrapped longitude", { west: -290, south: 10, east: -220, north: 40 }],
  ])(
    "keeps %s on Tianditu even when returning from overseas",
    (_name, bounds) => {
      expect(selectBasemap(bounds as ViewBounds, 12, "openfreemap")).toBe(
        "tianditu",
      );
    },
  );
  it("allows overseas detail, including an antimeridian viewport", () => {
    expect(selectBasemap(paris, 12)).toBe("openfreemap");
    expect(
      selectBasemap({ west: -75, south: 39, east: -73, north: 42 }, 12),
    ).toBe("openfreemap");
    expect(
      selectBasemap({ west: 170, south: -20, east: 190, north: 20 }, 8),
    ).toBe("openfreemap");
  });
  it("uses Tianditu for world views, invalid coordinates and low zoom", () => {
    expect(
      selectBasemap(
        { west: -180, south: -85, east: 180, north: 85 },
        8,
        "openfreemap",
      ),
    ).toBe("tianditu");
    expect(selectBasemap(paris, 5, "openfreemap")).toBe("tianditu");
    expect(selectBasemap({ ...paris, west: NaN }, 12, "openfreemap")).toBe(
      "tianditu",
    );
  });
  it("avoids toggling at the entry zoom and envelope edges", () => {
    expect(selectBasemap(paris, 5.3, "tianditu")).toBe("tianditu");
    expect(selectBasemap(paris, 5.3, "openfreemap")).toBe("openfreemap");
    const nearEdge = { west: 141, south: 20, east: 144, north: 25 };
    expect(selectBasemap(nearEdge, 8, "tianditu")).toBe("tianditu");
    expect(selectBasemap(nearEdge, 8, "openfreemap")).toBe("openfreemap");
  });
});

function fixture() {
  const listeners = new Map<string, Set<() => void>>();
  const view = { bounds: paris, zoom: 12 };
  const map = {
    on: (event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    off: (event: string, listener: () => void) =>
      listeners.get(event)?.delete(listener),
    getBounds: () => ({
      getWest: () => view.bounds.west,
      getSouth: () => view.bounds.south,
      getEast: () => view.bounds.east,
      getNorth: () => view.bounds.north,
    }),
    getZoom: () => view.zoom,
    setStyle: vi.fn(),
  };
  const callbacks = {
    onLoading: vi.fn(),
    onProvider: vi.fn(),
    onError: vi.fn(),
  };
  const official: StyleSpecification = {
    version: 8,
    name: "official",
    sources: {},
    layers: [],
  };
  const overseas: StyleSpecification = {
    version: 8,
    name: "overseas",
    sources: {},
    layers: [],
  };
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const binding = bindRegionalBasemap(
    map as unknown as LibreMap,
    official,
    callbacks,
  );
  const emit = (event: string) =>
    listeners.get(event)?.forEach((listener) => listener());
  const finish = async () => {
    resolve(new Response(JSON.stringify(overseas), { status: 200 }));
    await new Promise((done) => setTimeout(done, 0));
  };
  return { map, view, callbacks, binding, fetcher, emit, finish };
}
describe("regional basemap async switching", () => {
  it("cannot apply a late overseas style after re-entering the protected viewport", async () => {
    const f = fixture();
    f.emit("move");
    f.emit("move");
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(f.binding.isPending()).toBe(true);
    f.view.bounds = china;
    f.emit("move");
    expect(f.map.setStyle.mock.calls[0][0].name).toBe("official");
    expect(f.binding.isPending()).toBe(false);
    await f.finish();
    expect(f.map.setStyle).toHaveBeenCalledTimes(1);
    expect(f.callbacks.onError).not.toHaveBeenCalled();
    f.binding.dispose();
  });
  it("replaces overseas detail with the official map immediately when zooming out", async () => {
    const f = fixture();
    f.emit("move");
    await f.finish();
    expect(f.map.setStyle.mock.calls[0][0].name).toBe("overseas");
    f.view.zoom = 4;
    f.emit("move");
    expect(f.map.setStyle.mock.calls[1][0].name).toBe("official");
    f.binding.dispose();
  });
  it("does not mutate a destroyed map after a response completes", async () => {
    const f = fixture();
    f.emit("move");
    f.binding.dispose();
    await f.finish();
    expect(f.map.setStyle).not.toHaveBeenCalled();
    expect(f.callbacks.onError).not.toHaveBeenCalled();
  });
});
