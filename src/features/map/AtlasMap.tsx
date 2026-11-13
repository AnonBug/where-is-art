import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Map as LibreMap,
  Marker,
  NavigationControl,
  AttributionControl,
  setWorkerUrl,
  LngLatBounds,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import { useSession, type Camera } from "../../application/session";
import {
  scopeVenues,
  venueWorks,
  type BrowseAtlas,
  type ArtworkSummary,
  type VenueSummary,
} from "../../domain/atlas";
import { IconButton } from "../../shared/ui";
import { ClusterMarker } from "./ClusterMarker";
import { VenueMarker } from "./VenueMarker";
import { bindVenueZoom, VENUE_FOCUS_ZOOM } from "./venueZoom";
import { autoExpandedVenues } from "./venueExpansion";
import { createTiandituStyle } from "../../infrastructure/tianditu";
import {
  bindRegionalBasemap,
  type BasemapProvider,
} from "../../infrastructure/regionalBasemap";
import s from "./AtlasMap.module.scss";
setWorkerUrl(workerUrl);
interface Props {
  data: BrowseAtlas;
  works: ArtworkSummary[];
  scope: string;
  historyKey: string;
  selected?: string;
  expandedVenue?: string;
  compact: boolean;
  panel: boolean;
  focus: { ids: string[]; nonce: number } | null;
  onFocusHandled: (nonce: number) => void;
  onWork: (id: string) => void;
  onVenue: (id: string) => void;
  onVenueCollapse: () => void;
  onOverview: () => void;
  onList: () => void;
  onCanvasInteraction?: () => void;
}
interface RenderMarker {
  key: string;
  node: HTMLElement;
  venue?: VenueSummary;
  works: ArtworkSummary[];
  cluster?: number;
  coordinates: [number, number];
  showLabel: boolean;
  autoExpanded: boolean;
}
export default function AtlasMap({
  data,
  works,
  scope,
  historyKey,
  selected,
  expandedVenue,
  compact,
  panel,
  focus,
  onFocusHandled,
  onWork,
  onVenue,
  onVenueCollapse,
  onOverview,
  onList,
  onCanvasInteraction,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const preserveCameraOnNavigation = useRef(false);
  const venueSelection = useRef({
    id: expandedVenue,
    collapse: onVenueCollapse,
  });
  venueSelection.current = { id: expandedVenue, collapse: onVenueCollapse };
  const [autoExpandVenues, setAutoExpandVenues] = useState(false);
  const [collapsedVenues, setCollapsedVenues] = useState<Set<string>>(
    () => new Set(),
  );
  const [renderMarkers, setRenderMarkers] = useState<RenderMarker[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(0);
  const [provider, setProvider] = useState<BasemapProvider>("tianditu");
  const keyRef = useRef(historyKey);
  keyRef.current = historyKey;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const venues = useMemo(() => scopeVenues(data, works), [data, works]);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const cluster = useMemo(
    () =>
      new Supercluster<{ venueId: string }>({
        radius: compact ? 68 : 58,
        maxZoom: 10,
        minPoints: 2,
      }).load(
        venues.map((venue) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: venue.coordinates! },
          properties: { venueId: venue.id },
        })),
      ),
    [venues, compact],
  );
  function fit(ids?: string[]) {
    const map = mapRef.current;
    if (!map) return;
    const targets = venuesRef.current.filter((v) => !ids || ids.includes(v.id));
    if (!targets.length) return;
    const points = targets.map((v) => v.coordinates!);
    // One world is rendered, so fit the actual coordinates rather than an invisible wrapped copy.
    const bounds = new LngLatBounds(points[0], points[0]);
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, {
      padding: {
        top: compact ? 125 : 85,
        bottom: 90,
        left: compact ? 55 : 80,
        right: panelRef.current && !compact ? 400 : compact ? 55 : 80,
      },
      maxZoom: points.length === 1 ? VENUE_FOCUS_ZOOM : 8,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 600,
    });
  }
  function interactWithCanvas(target: EventTarget) {
    // Marker and control buttons keep their own navigation actions.
    if (!onCanvasInteraction || !(target instanceof HTMLCanvasElement)) return;
    preserveCameraOnNavigation.current = true;
    onCanvasInteraction();
  }
  useEffect(() => {
    if (!container.current) return;
    setLoading(true);
    setError("");
    setReady(0);
    setProvider("tianditu");
    let map: LibreMap;
    let style;
    try {
      style = createTiandituStyle(import.meta.env.VITE_TIANDITU_KEY);
    } catch (error) {
      setError(error instanceof Error ? error.message : "天地图配置不可用。");
      setLoading(false);
      return;
    }
    const snapshot =
      useSession.getState().cameras[`${scope}:${keyRef.current}`] ??
      useSession.getState().cameras[scope];
    try {
      map = new LibreMap({
        container: container.current,
        style,
        center: snapshot?.center ?? [105, 30],
        zoom: snapshot?.zoom ?? 2.8,
        maxZoom: 18,
        minZoom: 1,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        renderWorldCopies: false,
        trackResize: false,
      });
    } catch {
      setError("当前浏览器无法绘制地图，可继续浏览作品。");
      setLoading(false);
      return;
    }
    mapRef.current = map;
    // Handle errors here so SDK logging never prints a tile URL containing the Key.
    let failed = false;
    const fail = () => {
      failed = true;
      setLoading(false);
      setError("地图加载失败，请重试或先浏览作品。");
    };
    map.on("error", fail);
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    if (!compact)
      map.addControl(
        new NavigationControl({ showCompass: false }),
        "bottom-right",
      );
    let initialized = false;
    const save = () => {
      if (!initialized) return;
      const c = map.getCenter();
      const camera: Camera = { center: [c.lng, c.lat], zoom: map.getZoom() };
      useSession.getState().saveCamera(scope, camera);
      useSession.getState().saveCamera(`${scope}:${keyRef.current}`, camera);
    };
    let timer: ReturnType<typeof setTimeout>;
    const startLoading = () => {
      failed = false;
      setError("");
      setLoading(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setError("底图加载较慢，可重试或先浏览作品。");
        setLoading(false);
      }, 14000);
    };
    const basemap = bindRegionalBasemap(map, style, {
      onLoading: startLoading,
      onProvider: setProvider,
      onError: fail,
    });
    startLoading();
    map.on("idle", () => {
      if (basemap.isPending() || !map.loaded()) return;
      clearTimeout(timer);
      setLoading(false);
      if (!failed) setError("");
    });
    map.once("load", () => {
      initialized = true;
      if (!snapshot) fit();
      setReady((n) => n + 1);
    });
    map.on("moveend", save);
    // Resize and repaint together before the browser composites the next frame.
    // Keep one observer so the SDK's throttled observer cannot race the animation.
    const observer = new ResizeObserver(() => {
      map.resize();
      map.redraw();
    });
    observer.observe(container.current);
    return () => {
      save();
      basemap.dispose();
      clearTimeout(timer);
      observer.disconnect();
      markers.current.forEach((m) => m.remove());
      markers.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // Scope changes remount this component; other route changes must not recreate its canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, compact, attempt]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (preserveCameraOnNavigation.current) {
      preserveCameraOnNavigation.current = false;
      const center = map.getCenter();
      useSession.getState().saveCamera(`${scope}:${historyKey}`, {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      });
      return;
    }
    const snapshot = useSession.getState().cameras[`${scope}:${historyKey}`];
    if (snapshot) map.jumpTo(snapshot);
  }, [historyKey, scope]);
  useEffect(() => {
    const map = mapRef.current;
    const venue = venues.find((item) => item.id === expandedVenue);
    if (!map || !ready || !venue?.coordinates) return;
    // Back navigation restores the saved camera instead of replaying the zoom.
    if (useSession.getState().cameras[`${scope}:${historyKey}`]) return;
    map.easeTo({
      center: venue.coordinates,
      zoom: Math.max(map.getZoom(), VENUE_FOCUS_ZOOM),
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 600,
    });
  }, [expandedVenue, historyKey, scope, ready, venues]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    return bindVenueZoom(map, setAutoExpandVenues, () => {
      if (venueSelection.current.id) {
        // Removing the selection from the URL must not stop an ongoing zoom.
        venueSelection.current.id = undefined;
        preserveCameraOnNavigation.current = true;
        venueSelection.current.collapse();
      }
    });
  }, [ready]);
  useEffect(() => {
    if (!focus || !ready) return;
    fit(focus.ids.length ? focus.ids : undefined);
    onFocusHandled(focus.nonce);
  }, [focus, ready, onFocusHandled]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !panel || compact || !selected) return;
    const venue = venues.find((v) =>
      venueWorks(data, works, [v.id]).some((w) => w.id === selected),
    );
    if (!venue?.coordinates) return;
    const point = map.project(venue.coordinates);
    const width = map.getContainer().clientWidth;
    const rightEdge = width - 410;
    if (
      point.x > rightEdge &&
      point.x < width &&
      point.y > 0 &&
      point.y < map.getContainer().clientHeight
    ) {
      map.panBy([point.x - rightEdge, 0], { duration: 250 });
    }
  }, [panel, selected, compact, ready, data, works, venues]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function update() {
      if (!map) return;
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const items = cluster.getClusters(
        [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ],
        Math.floor(zoom),
      );
      const occupied: { x: number; y: number }[] = [];
      const next: RenderMarker[] = [];
      const visibleKeys = new Set<string>();
      const ordered = [...items].sort((a, b) => {
        const aSelected =
          !("cluster" in a.properties) &&
          (a.properties.venueId === expandedVenue ||
            venueWorks(data, works, [a.properties.venueId]).some(
              (w) => w.id === selected,
            ));
        const bSelected =
          !("cluster" in b.properties) &&
          (b.properties.venueId === expandedVenue ||
            venueWorks(data, works, [b.properties.venueId]).some(
              (w) => w.id === selected,
            ));
        return Number(bSelected) - Number(aSelected);
      });
      for (const item of ordered) {
        const clusterId =
          "cluster_id" in item.properties
            ? Number(item.properties.cluster_id)
            : undefined;
        const isCluster = clusterId !== undefined;
        const ids = isCluster
          ? cluster
              .getLeaves(clusterId, Infinity)
              .map((leaf) => leaf.properties.venueId)
          : [item.properties.venueId];
        const collection = venueWorks(data, works, ids);
        if (!collection.length) continue;
        const coordinates = item.geometry.coordinates as [number, number];
        const point = map.project(coordinates);
        const showLabel = !occupied.some(
          (p) => Math.abs(p.x - point.x) < 180 && Math.abs(p.y - point.y) < 90,
        );
        if (showLabel) occupied.push(point);
        const key = isCluster ? `cluster:${clusterId}` : ids[0];
        visibleKeys.add(key);
        // A portal needs the same container as well as the same key to retain
        // its images, focus and scroll position across pan/zoom updates.
        let marker = markers.current.get(key);
        if (!marker) {
          marker = new Marker({
            element: document.createElement("div"),
            anchor: "center",
          })
            .setLngLat(coordinates)
            .addTo(map);
          markers.current.set(key, marker);
        } else {
          marker.setLngLat(coordinates);
        }
        const node = marker.getElement();
        node.style.zIndex = ids.includes(expandedVenue ?? "")
          ? "3"
          : collection.some((work) => work.id === selected)
            ? "2"
            : "1";
        next.push({
          key,
          node,
          venue: isCluster ? undefined : venues.find((v) => v.id === ids[0]),
          works: collection,
          cluster: clusterId,
          coordinates,
          showLabel,
          autoExpanded: false,
        });
      }
      for (const [key, marker] of markers.current) {
        if (!visibleKeys.has(key)) {
          marker.remove();
          markers.current.delete(key);
        }
      }
      const automatic = autoExpandedVenues(
        next.map((marker) => ({
          id: marker.key,
          ...map.project(marker.coordinates),
          count: marker.works.length,
          cluster: marker.cluster !== undefined,
        })),
        {
          width: map.getContainer().clientWidth,
          height: map.getContainer().clientHeight,
          windowHeight: window.innerHeight,
          compact,
          landscape:
            window.innerWidth > window.innerHeight && window.innerHeight <= 600,
        },
      );
      setRenderMarkers(
        next.map((marker) => ({
          ...marker,
          autoExpanded: automatic.has(marker.key),
        })),
      );
    }
    update();
    // MapLibre also fires moveend after zooming; one update covers both.
    map.on("moveend", update);
    map.on("resize", update);
    return () => {
      map.off("moveend", update);
      map.off("resize", update);
    };
  }, [data, works, venues, selected, expandedVenue, cluster, ready, compact]);
  return (
    <div className={s.map} data-basemap={provider}>
      <div
        ref={container}
        className={s.canvas}
        aria-label="作品收藏地地图"
        onPointerDownCapture={(event) => interactWithCanvas(event.target)}
        onWheelCapture={(event) => interactWithCanvas(event.target)}
      />
      {renderMarkers.map((marker) =>
        createPortal(
          marker.cluster !== undefined ? (
            <ClusterMarker
              data={data}
              works={marker.works}
              selected={selected}
              onWork={onWork}
              onExpand={() => {
                const map = mapRef.current;
                if (!map) return;
                map.easeTo({
                  center: marker.coordinates,
                  zoom: Math.min(
                    cluster.getClusterExpansionZoom(marker.cluster!),
                    17,
                  ),
                  duration: 450,
                });
              }}
            />
          ) : (
            marker.venue && (
              <VenueMarker
                data={data}
                venue={marker.venue}
                works={marker.works}
                selected={selected}
                expanded={
                  marker.venue.id === expandedVenue ||
                  (!expandedVenue &&
                    autoExpandVenues &&
                    marker.autoExpanded &&
                    !collapsedVenues.has(marker.key))
                }
                showLabel={marker.showLabel}
                onExpand={() => {
                  setCollapsedVenues((previous) => {
                    const next = new Set(previous);
                    next.delete(marker.key);
                    return next;
                  });
                  onVenue(marker.venue!.id);
                }}
                onCollapse={() => {
                  setCollapsedVenues((previous) =>
                    new Set(previous).add(marker.key),
                  );
                  if (expandedVenue === marker.venue!.id) {
                    preserveCameraOnNavigation.current = true;
                    onVenueCollapse();
                  }
                }}
                onWork={onWork}
              />
            )
          ),
          marker.node,
          marker.key,
        ),
      )}
      {loading && (
        <div className={s.status} role="status">
          正在展开地图…
        </div>
      )}
      {error && (
        <div className={s.error} role="status">
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>重新加载</button>
          <button onClick={onList}>浏览作品</button>
        </div>
      )}
      {!loading && !error && !venues.length && (
        <div className={s.status}>作品收藏地点待核实，可从列表看画。</div>
      )}
      <div className={s.overview}>
        <IconButton icon="map" label="查看整体分布" onClick={onOverview} />
        <button
          className={s.count}
          onClick={onList}
          aria-label={`浏览当前范围的 ${works.length} 幅作品`}
        >
          {works.length} 幅作品 · {venues.length} 个收藏地
        </button>
      </div>
      {!loading && !renderMarkers.length && !!venues.length && !error && (
        <button className={s.return} onClick={onOverview}>
          查看整体分布
        </button>
      )}
    </div>
  );
}
