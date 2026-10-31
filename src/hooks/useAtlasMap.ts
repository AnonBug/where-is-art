import { useEffect, useRef } from "react";
import L from "leaflet";
import { clusterMuseums } from "../lib/map";
import type {
  ArtworkImages,
  MapFocus,
  Museums,
  Region,
  Work,
  WorldMap,
} from "../types";

interface Options {
  world: WorldMap;
  museums: Museums;
  works: Work[];
  images: ArtworkImages;
  region: Region;
  regionRevision: number;
  focus: MapFocus | null;
  visible: boolean;
  onSelect: (ids: string[]) => void;
}

function fitRegion(map: L.Map, region: Region, museums: Museums) {
  if (region === "europe")
    map.fitBounds(
      [
        [39, -7],
        [62, 35],
      ],
      { paddingTopLeft: [25, 85], paddingBottomRight: [25, 55], maxZoom: 4.3 },
    );
  else if (region === "world")
    map.fitBounds(
      [
        [-55, -170],
        [75, 170],
      ],
      { paddingTopLeft: [20, 80], paddingBottomRight: [20, 60], maxZoom: 4 },
    );
  else {
    const positions: L.LatLngTuple[] = Object.values(museums).map((museum) => [
      museum.lat,
      museum.lng,
    ]);
    if (positions.length)
      map.fitBounds(positions, {
        paddingTopLeft: [40, 90],
        paddingBottomRight: [40, 80],
        maxZoom: 5,
      });
    else map.setView([25, 15], 2);
  }
}

// Leaflet owns only this container. React owns panels and all other interface state.
export function useAtlasMap({
  world,
  museums,
  works,
  images,
  region,
  regionRevision,
  focus,
  visible,
  onSelect,
}: Options) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const regionRef = useRef(region);
  regionRef.current = region;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      minZoom: 1,
      maxZoom: 17,
      worldCopyJump: false,
      scrollWheelZoom: true,
      zoomSnap: 0.25,
      maxBounds: [
        [-70, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 0.9,
    });
    mapRef.current = map;
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>',
    );
    map.attributionControl.addAttribution(
      '<a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a> · 收藏机构近似位置',
    );
    const highlight = new Set(
      Object.values(museums).map((museum) => museum.mapCountry),
    );
    L.geoJSON(world, {
      style: (feature) => ({
        color: "#c6c9b8",
        weight: 0.7,
        fillColor: highlight.has(feature?.properties.name)
          ? "#f6f0db"
          : "#edeedd",
        fillOpacity: 1,
      }),
      interactive: false,
    }).addTo(map);
    fitRegion(map, regionRef.current, museums);
    let mobile = window.innerWidth < 760;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (
          !containerRef.current?.clientWidth ||
          !containerRef.current?.clientHeight
        )
          return;
        map.invalidateSize({ pan: false });
        const nextMobile = window.innerWidth < 760;
        if (nextMobile !== mobile) {
          mobile = nextMobile;
          fitRegion(map, regionRef.current, museums);
        }
      });
    });
    observer.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [world, museums]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    function renderMarkers() {
      if (!map) return;
      layer.clearLayers();
      const groups = clusterMuseums(museums, works, (lat, lng) =>
        map.latLngToLayerPoint([lat, lng]),
      );
      for (const group of groups) {
        const cities = [...new Set(group.ids.map((id) => museums[id].city))];
        const label =
          cities.length > 1 ? `${cities[0]}等 ${cities.length} 城` : cities[0];
        const marker = document.createElement("div");
        marker.className = "marker-inner";
        const frame = document.createElement("div");
        frame.className = "marker-art";
        const image = document.createElement("img");
        image.src = images[group.works[0].id].path;
        image.alt = "";
        const count = document.createElement("b");
        count.textContent = String(group.works.length);
        const caption = document.createElement("span");
        caption.textContent = label;
        frame.append(image, count);
        marker.append(frame, caption);
        const icon = L.divIcon({
          className: "museum-marker",
          html: marker,
          iconSize: [86, 70],
          iconAnchor: [43, 44],
        });
        L.marker([group.lat, group.lng], {
          icon,
          title: `${cities.join("、")}，${group.ids.length}个收藏机构，${group.works.length}件作品`,
          keyboard: true,
          alt: label,
        })
          .on("click", () => onSelect(group.ids))
          .addTo(layer);
      }
    }
    renderMarkers();
    map.on("zoomend", renderMarkers);
    return () => {
      map.off("zoomend", renderMarkers);
      layer.remove();
    };
  }, [world, museums, works, images, onSelect]);

  useEffect(() => {
    if (mapRef.current) fitRegion(mapRef.current, region, museums);
  }, [region, regionRevision, world, museums]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      if (!focus) return;
      const positions: L.LatLngTuple[] = focus.museumIds
        .filter((id) => museums[id])
        .map((id) => [museums[id].lat, museums[id].lng]);
      const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (positions.length === 1)
        map.setView(positions[0], Math.max(map.getZoom(), 7), { animate });
      else if (positions.length > 1)
        map.fitBounds(positions, { padding: [80, 80], maxZoom: 13, animate });
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, visible, world, museums]);

  return containerRef;
}
