// @vitest-environment jsdom
import type OpenSeadragon from "openseadragon";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import catalog from "../public/catalog.json";
import { atlasSchema, assetUrl, primaryImage } from "../src/domain/atlas";
import { useSession } from "../src/application/session";
import ArtworkViewer from "../src/features/viewer/ArtworkViewer";

const sdk = vi.hoisted(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  return { open: vi.fn() };
});
vi.mock("openseadragon", () => ({ default: sdk.open }));
const { default: OSD } = await vi.importActual<{
  default: typeof OpenSeadragon;
}>("openseadragon");
Object.assign(sdk.open, { Point: OSD.Point });
const data = atlasSchema.parse(catalog);
let resizeViewer: () => void;

function mount(workId = "tang-yin-01") {
  const asset = primaryImage(data, workId)!;
  const size = new OSD.Point(asset.delivery.width, asset.delivery.height);
  const viewport = new OSD.Viewport({
    containerSize: new OSD.Point(1280, 720),
    animationTime: 0.2,
    maxZoomPixelRatio: 1.5,
  });
  viewport.resetContentSize(size);
  const preview = {
    getContentSize: () => size,
    getFullyLoaded: vi.fn(() => false),
    viewportToImageCoordinates: (point: OpenSeadragon.Point) =>
      point.times(size.x),
    imageToViewportCoordinates: (x: number, y: number) =>
      new OSD.Point(x / size.x, y / size.x),
    viewportToImageZoom: (zoom: number) => (zoom * 1280) / size.x,
    imageToViewportZoom: (scale: number) => (scale * size.x) / 1280,
  };
  const detail = { getFullyLoaded: vi.fn(() => false) };
  const events = new OSD.EventSource();
  const addTiledImage = vi.fn();
  const destroy = vi.fn();
  sdk.open.mockReturnValue({
    viewport,
    world: { getItemAt: (index: number) => (index === 0 ? preview : detail) },
    addHandler: events.addHandler.bind(events),
    addTiledImage,
    forceRedraw: vi.fn(),
    destroy,
  });
  const view = render(
    <ArtworkViewer
      data={data}
      work={data.artworks.find((work) => work.id === workId)!}
      compact={false}
      infoOpen={false}
      onBack={vi.fn()}
      onInfo={vi.fn()}
      onAsset={vi.fn()}
    />,
  );
  const emit = (type: string, args = {}) =>
    act(() => events.raiseEvent(type, args));
  emit("open");
  function drawPreview() {
    preview.getFullyLoaded.mockReturnValue(true);
    emit("update-viewport");
  }
  function zoomIn() {
    fireEvent.click(screen.getByRole("button", { name: "放大画作" }));
    act(() => {
      vi.advanceTimersByTime(250);
      viewport.update();
      events.raiseEvent("animation-finish");
    });
  }
  return {
    ...view,
    asset,
    viewport,
    preview,
    detail,
    addTiledImage,
    destroy,
    emit,
    drawPreview,
    zoomIn,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(OSD, "now").mockImplementation(() => Date.now());
  sdk.open.mockClear();
  useSession.setState({ imageViews: {} });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeViewer = callback;
      }
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
  vi.unstubAllEnvs();
});

it.each(["mona", "tang-yin-02"])(
  "loads the %s preview and detail from the configured host with anonymous CORS",
  (workId) => {
    const base = "https://assets.example/where-is-art/";
    vi.stubEnv("VITE_ASSET_BASE_URL", base);
    vi.stubEnv("BASE_URL", "/different-app/");
    const { asset, addTiledImage } = mount(workId);
    const options = sdk.open.mock.calls[0][0];
    expect(options.crossOriginPolicy).toBe("Anonymous");
    expect(options.tileSources.getTileUrl()).toBe(base + asset.preview.url);
    const source = addTiledImage.mock.calls[0][0].tileSource;
    expect(asset.delivery.kind === "dzi" ? source : source.url).toBe(
      base + asset.delivery.url,
    );
    expect(
      screen.getByRole("link", { name: /^下载/ }).getAttribute("href"),
    ).toBe(
      base +
        (asset.delivery.kind === "dzi"
          ? asset.preview.url
          : asset.delivery.url),
    );
  },
);

it.each(["tang-yin-01", "tang-yin-02", "mona"])(
  "keeps %s interactive while detail loads and preserves its view when detail arrives",
  (workId) => {
    const {
      asset,
      viewport,
      detail,
      addTiledImage,
      destroy,
      emit,
      drawPreview,
      zoomIn,
    } = mount(workId);
    const source = new OSD.TileSource(sdk.open.mock.calls[0][0].tileSources);
    const download = screen.getByRole("link", { name: /^下载/ });
    expect(download.getAttribute("href")).toBe(
      assetUrl(
        asset.delivery.kind === "dzi" ? asset.preview.url : asset.delivery.url,
      ),
    );
    expect(download.getAttribute("download")).toBeTruthy();
    expect(source.getTileUrl(0, 0, 0)).toBe(assetUrl(asset.preview.url));
    expect(source.getNumTiles(0)).toEqual(new OSD.Point(1, 1));
    expect(source.dimensions).toEqual(
      new OSD.Point(asset.delivery.width, asset.delivery.height),
    );
    drawPreview();
    expect(screen.queryByText("正在加载画作细节…")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    const homeZoom = viewport.getZoom(true);
    zoomIn();
    expect(viewport.getZoom(true)).toBeGreaterThan(homeZoom);
    viewport.panTo(viewport.getCenter(true).plus(new OSD.Point(0.05, 0)), true);
    emit("animation-finish");
    const center = viewport.getCenter(true);
    const zoom = viewport.getZoom(true);
    const saved = useSession.getState().imageViews[`${workId}:${asset.id}`];

    act(() => vi.advanceTimersByTime(16000));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => addTiledImage.mock.calls[0][0].success());
    detail.getFullyLoaded.mockReturnValue(true);
    emit("update-viewport");
    expect(viewport.getCenter(true)).toEqual(center);
    expect(viewport.getZoom(true)).toBe(zoom);
    expect(useSession.getState().imageViews[`${workId}:${asset.id}`]).toEqual(
      saved,
    );
    expect(sdk.open).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  },
);

it.each([
  ["放大画作", 270],
  ["缩小画作", Math.round(200 / 1.35)],
  ["还原全图", 100],
])(
  "updates the zoom percentage throughout %s, before the animation finishes",
  (label, target) => {
    const { viewport, emit, drawPreview } = mount("tang-yin-15");
    drawPreview();
    viewport.zoomTo(viewport.getHomeZoom() * 2, undefined, true);
    emit("animation-finish");
    expect(screen.getByText("200%")).toBeTruthy();
    const saved = useSession.getState().imageViews;

    fireEvent.click(screen.getByRole("button", { name: label }));
    act(() => {
      vi.advanceTimersByTime(40);
      viewport.update();
    });
    emit("update-viewport");
    const intermediate = Math.round(
      (viewport.getZoom(true) / viewport.getHomeZoom()) * 100,
    );
    expect(intermediate).not.toBe(200);
    expect(intermediate).not.toBe(target);
    expect(screen.getByText(`${intermediate}%`)).toBeTruthy();
    // Display updates must not save a new session snapshot on every frame.
    expect(useSession.getState().imageViews).toBe(saved);

    act(() => {
      vi.advanceTimersByTime(200);
      viewport.update();
    });
    emit("update-viewport");
    expect(screen.getByText(`${target}%`)).toBeTruthy();
    emit("animation-finish");
    expect(useSession.getState().imageViews).not.toBe(saved);
  },
);

it("lets a low-resolution image reach 400% before and after detail loads and after resizing", () => {
  const { viewport, detail, addTiledImage, emit, drawPreview, zoomIn } =
    mount("tang-yin-15");
  drawPreview();
  for (let n = 0; n < 6; n++) zoomIn();
  expect(viewport.getZoom(true) / viewport.getHomeZoom()).toBeCloseTo(4);
  expect(screen.getByText("400%")).toBeTruthy();

  act(() => addTiledImage.mock.calls[0][0].success());
  detail.getFullyLoaded.mockReturnValue(true);
  emit("update-viewport");
  expect(viewport.getZoom(true) / viewport.getHomeZoom()).toBeCloseTo(4);

  const stage = sdk.open.mock.calls[0][0].element;
  Object.defineProperties(stage, {
    clientWidth: { value: 390 },
    clientHeight: { value: 844 },
  });
  act(() => resizeViewer());
  for (let n = 0; n < 6; n++) zoomIn();
  expect(viewport.getZoom(true) / viewport.getHomeZoom()).toBeCloseTo(4);
  fireEvent.click(screen.getByRole("button", { name: "还原全图" }));
  act(() => {
    vi.advanceTimersByTime(250);
    viewport.update();
  });
  expect(viewport.getZoom(true) / viewport.getHomeZoom()).toBeCloseTo(1);
});

it("keeps the preview usable after a detail failure and ignores late callbacks after exit", () => {
  const { viewport, addTiledImage, drawPreview, zoomIn, unmount, destroy } =
    mount();
  drawPreview();
  const request = addTiledImage.mock.calls[0][0];
  act(() => request.error());
  expect(screen.getByRole("status").textContent).toContain("可继续浏览预览");
  const before = viewport.getZoom(true);
  zoomIn();
  expect(viewport.getZoom(true)).toBeGreaterThan(before);
  unmount();
  act(() => {
    request.success();
    request.error();
    vi.advanceTimersByTime(16000);
  });
  expect(destroy).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
});
