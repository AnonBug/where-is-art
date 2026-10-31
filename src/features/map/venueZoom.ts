import type { Map as LibreMap, MapMovementEvent } from "maplibre-gl";

// Keep museum navigation at a city scale, with room for a small zoom adjustment.
export const VENUE_FOCUS_ZOOM = 9;
export const VENUE_COLLAPSE_ZOOM = 8;

export function bindVenueZoom(
  map: Pick<LibreMap, "getZoom" | "on" | "off">,
  onExpansionChange: (expanded: boolean) => void,
  onUserZoomOut: () => void,
) {
  let previousZoom = map.getZoom();
  let expanded = previousZoom >= VENUE_FOCUS_ZOOM;
  onExpansionChange(expanded);
  const onZoom = (event: MapMovementEvent) => {
    const zoom = map.getZoom();
    const zoomingOut = zoom < previousZoom;
    previousZoom = zoom;
    const next =
      zoom >= VENUE_FOCUS_ZOOM
        ? true
        : zoom <= VENUE_COLLAPSE_ZOOM
          ? false
          : expanded;
    if (next !== expanded) {
      expanded = next;
      onExpansionChange(expanded);
    }
    // Only a user's zoom clears the explicit museum selection from the URL.
    if (event.originalEvent && zoomingOut && zoom <= VENUE_COLLAPSE_ZOOM) {
      onUserZoomOut();
    }
  };
  map.on("zoom", onZoom);
  return () => {
    map.off("zoom", onZoom);
  };
}
