// @vitest-environment jsdom
import type OpenSeadragon from "openseadragon";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../public/catalog.json";
import { atlasSchema } from "../src/domain/atlas";
import { useSession } from "../src/application/session";
import ArtworkViewer from "../src/features/viewer/ArtworkViewer";

const sdk = vi.hoisted(() => {
  // The real viewport/springs need no renderer in these interaction tests.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  return { open: vi.fn() };
});
vi.mock("openseadragon", () => ({ default: sdk.open }));
const { default: OSD } = await vi.importActual<{
  default: typeof OpenSeadragon;
}>("openseadragon");
const data = atlasSchema.parse(catalog);

function mount() {
  const viewport = new OSD.Viewport({
    containerSize: new OSD.Point(390, 844),
    animationTime: 0.2,
    visibilityRatio: 0.85,
    maxZoomLevel: 10,
  });
  viewport.zoomTo(4, undefined, true);
  viewport.update();
  const events = new OSD.EventSource();
  sdk.open.mockReturnValue({
    viewport,
    world: { getItemAt: () => undefined },
    addHandler: events.addHandler.bind(events),
    destroy: vi.fn(),
  });
  render(
    <ArtworkViewer
      data={data}
      work={data.artworks.find((work) => work.id === "tang-yin-01")!}
      compact
      infoOpen={false}
      onBack={vi.fn()}
      onInfo={vi.fn()}
      onAsset={vi.fn()}
    />,
  );
  return { viewport, events };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(OSD, "now").mockImplementation(() => Date.now());
  sdk.open.mockClear();
  useSession.setState({ imageViews: {} });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("touch panning in the artwork viewer", () => {
  it("stops at the displayed position on release instead of finishing the pan spring", () => {
    const { viewport, events } = mount();
    expect(sdk.open.mock.calls[0][0].gestureSettingsTouch.flickEnabled).toBe(
      false,
    );
    const initial = viewport.getCenter(true);
    viewport.panBy(new OSD.Point(0.12, 0.06), false);
    vi.advanceTimersByTime(40);
    viewport.update();
    const released = viewport.getCenter(true);
    expect(released.x).toBeGreaterThan(initial.x);
    expect(viewport.getCenter(false).equals(released)).toBe(false);

    act(() =>
      events.raiseEvent("canvas-drag-end", {
        pointerType: "touch",
        speed: 800,
      }),
    );
    expect(viewport.getCenter(false).equals(released)).toBe(true);
    vi.advanceTimersByTime(500);
    viewport.update();
    expect(viewport.getCenter(true).equals(released)).toBe(true);
  });

  it("keeps zoom controls animated and pinch zoom enabled after a touch drag", () => {
    const { viewport, events } = mount();
    act(() => events.raiseEvent("canvas-drag-end", { pointerType: "touch" }));
    expect(sdk.open.mock.calls[0][0].gestureSettingsTouch.pinchToZoom).toBe(
      true,
    );
    const initialZoom = viewport.getZoom(true);
    fireEvent.click(screen.getByRole("button", { name: "放大画作" }));
    expect(viewport.getZoom(true)).toBe(initialZoom);
    expect(viewport.getZoom(false)).toBeGreaterThan(initialZoom);
    vi.advanceTimersByTime(250);
    viewport.update();
    expect(viewport.getZoom(true)).toBeCloseTo(initialZoom * 1.35);
  });

  it("leaves mouse drag smoothing unchanged", () => {
    const { viewport, events } = mount();
    viewport.panBy(new OSD.Point(0.12, 0.06), false);
    const target = viewport.getCenter(false);
    act(() => events.raiseEvent("canvas-drag-end", { pointerType: "mouse" }));
    expect(viewport.getCenter(true).equals(target)).toBe(false);
    vi.advanceTimersByTime(250);
    viewport.update();
    expect(viewport.getCenter(true).equals(target)).toBe(true);
  });
});
