import type { Map as LibreMap, StyleSpecification } from "maplibre-gl";
import { assetUrl } from "../domain/atlas";

export type BasemapProvider = "tianditu" | "openfreemap";
export interface ViewBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// Conservative switching envelope, not an administrative boundary or a rendered mask.
// Includes the mainland, Taiwan and South China Sea; adjacent areas also retain Tianditu.
const protectedView = { west: 70, south: 0, east: 140, north: 56 };
const entryBuffer = { west: 67, south: -3, east: 143, north: 59 };
function intersects(view: ViewBounds, area: ViewBounds) {
  if (view.north < area.south || view.south > area.north) return false;
  if (view.east - view.west >= 360) return true;
  const wrap = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;
  const west = wrap(view.west);
  const east = wrap(view.east);
  return west <= east
    ? west <= area.east && east >= area.west
    : west <= area.east || east >= area.west;
}

export function selectBasemap(
  bounds: ViewBounds,
  zoom: number,
  current: BasemapProvider = "tianditu",
): BasemapProvider {
  if (
    ![...Object.values(bounds), zoom].every(Number.isFinite) ||
    bounds.south > bounds.north ||
    zoom <= 5 ||
    intersects(bounds, protectedView)
  )
    return "tianditu";
  if (current === "openfreemap") return "openfreemap";
  return zoom >= 5.5 && !intersects(bounds, entryBuffer)
    ? "openfreemap"
    : "tianditu";
}

interface Callbacks {
  onLoading: () => void;
  onProvider: (provider: BasemapProvider) => void;
  onError: () => void;
}

export function bindRegionalBasemap(
  map: LibreMap,
  tianditu: StyleSpecification,
  callbacks: Callbacks,
) {
  let active: BasemapProvider = "tianditu";
  let requested: BasemapProvider = "tianditu";
  let revision = 0;
  let disposed = false;
  let pending = false;
  let foreignStyle: Promise<StyleSpecification> | undefined;
  const abort = new AbortController();
  const desired = () => {
    const bounds = map.getBounds();
    return selectBasemap(
      {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
      map.getZoom(),
      active,
    );
  };
  const apply = (provider: BasemapProvider, style: StyleSpecification) => {
    pending = false;
    active = provider;
    // Replace the whole style immediately; no boundary stitching or cross-fade.
    map.setStyle(structuredClone(style), { diff: false });
    callbacks.onProvider(provider);
  };
  const update = () => {
    const next = desired();
    if (next === requested) return;
    requested = next;
    const requestRevision = ++revision;
    callbacks.onLoading();
    if (next === "tianditu") {
      apply(next, tianditu);
      return;
    }
    pending = true;
    foreignStyle ??= fetch(assetUrl("map-style.json"), {
      signal: abort.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Map style unavailable");
      const style = await response.json();
      if (style.version !== 8 || !Array.isArray(style.layers)) {
        throw new Error("Invalid map style");
      }
      return style as StyleSpecification;
    });
    void foreignStyle
      .then((style) => {
        // Ignore a late overseas response if the user has already returned to China.
        if (
          disposed ||
          requestRevision !== revision ||
          desired() !== "openfreemap"
        )
          return;
        apply("openfreemap", style);
      })
      .catch(() => {
        if (disposed || requestRevision !== revision) return;
        pending = false;
        callbacks.onError();
      });
  };
  // move runs before the next rendered frame, including jumps and animated zoom-outs.
  map.on("move", update);
  map.on("resize", update);
  map.on("load", update);
  return {
    isPending: () => pending,
    dispose() {
      disposed = true;
      revision++;
      abort.abort();
      map.off("move", update);
      map.off("resize", update);
      map.off("load", update);
    },
  };
}
