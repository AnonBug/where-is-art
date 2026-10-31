import type { Map as LibreMap, MapMovementEvent } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import { bindVenueZoom } from "../src/features/map/venueZoom";

function fixture(initialZoom = 9) {
  let zoom = initialZoom;
  const listeners = new Set<(event: MapMovementEvent) => void>();
  const map = {
    getZoom: () => zoom,
    on: (_type: string, listener: (event: MapMovementEvent) => void) => {
      listeners.add(listener);
    },
    off: (_type: string, listener: (event: MapMovementEvent) => void) => {
      listeners.delete(listener);
    },
  };
  const collapse = vi.fn();
  const expansion = vi.fn();
  const dispose = bindVenueZoom(
    map as unknown as LibreMap,
    expansion,
    collapse,
  );
  return {
    collapse,
    expansion,
    dispose,
    changeZoom: (value: number, userInitiated = true) => {
      zoom = value;
      const event = {
        originalEvent: userInitiated ? { type: "wheel" } : undefined,
      } as MapMovementEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe("museum expansion during zoom", () => {
  it("automatically expands and collapses while keeping the state between thresholds", () => {
    const view = fixture(7);
    expect(view.expansion).toHaveBeenLastCalledWith(false);
    view.changeZoom(8.6);
    expect(view.expansion).toHaveBeenCalledTimes(1);
    view.changeZoom(9);
    expect(view.expansion).toHaveBeenLastCalledWith(true);
    view.changeZoom(9.2);
    view.changeZoom(8.6);
    expect(view.expansion).toHaveBeenCalledTimes(2);
    view.changeZoom(8);
    expect(view.expansion).toHaveBeenLastCalledWith(false);
    view.changeZoom(8.8);
    expect(view.expansion).toHaveBeenCalledTimes(3);
    view.changeZoom(9);
    expect(view.expansion).toHaveBeenLastCalledWith(true);
  });

  it("only clears an explicit museum selection on a user's zoom out to a regional view", () => {
    const view = fixture();
    view.changeZoom(8.6);
    expect(view.collapse).not.toHaveBeenCalled();
    view.changeZoom(8);
    expect(view.collapse).toHaveBeenCalledTimes(1);
    view.changeZoom(7.5);
    view.changeZoom(9);
    view.changeZoom(7);
    expect(view.collapse).toHaveBeenCalledTimes(3);
  });

  it("ignores focus animations and camera restoration, but responds to later user zoom", () => {
    const view = fixture(3);
    view.changeZoom(9, false);
    expect(view.expansion).toHaveBeenLastCalledWith(true);
    view.changeZoom(7, false);
    expect(view.expansion).toHaveBeenLastCalledWith(false);
    expect(view.collapse).not.toHaveBeenCalled();
    view.changeZoom(6.8);
    expect(view.collapse).toHaveBeenCalledOnce();
  });

  it("does not collapse when zooming in or repeating the same zoom", () => {
    const view = fixture(7);
    view.changeZoom(7);
    view.changeZoom(7.5);
    view.changeZoom(8);
    view.changeZoom(9);
    expect(view.collapse).not.toHaveBeenCalled();
  });

  it("stops listening when the museum or map is no longer active", () => {
    const view = fixture();
    view.dispose();
    view.changeZoom(7);
    expect(view.collapse).not.toHaveBeenCalled();
  });
});
