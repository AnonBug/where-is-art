// @vitest-environment jsdom
import { StrictMode, type ComponentProps } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../public/catalog.json";
import { atlasSchema, scopeWorks } from "../src/domain/atlas";
import { useSession } from "../src/application/session";
import AtlasMap from "../src/features/map/AtlasMap";

const sdk = vi.hoisted(() => {
  type Listener = (event: { type: string }) => void;
  class TestMap {
    static instances: TestMap[] = [];
    listeners = new Map<string, Set<Listener>>();
    zoom = 7;
    bounds = [-180, -85, 180, 85];
    container: HTMLElement;
    constructor({ container }: { container: HTMLElement }) {
      this.container = container;
      TestMap.instances.push(this);
    }
    on(type: string, callback: Listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(callback);
    }
    off(type: string, callback: Listener) {
      this.listeners.get(type)?.delete(callback);
    }
    once(type: string, callback: () => void) {
      const once = () => {
        this.off(type, once);
        callback();
      };
      this.on(type, once);
    }
    emit(type: string) {
      for (const callback of [...(this.listeners.get(type) ?? [])])
        callback({ type });
    }
    getBounds() {
      return {
        getWest: () => this.bounds[0],
        getSouth: () => this.bounds[1],
        getEast: () => this.bounds[2],
        getNorth: () => this.bounds[3],
      };
    }
    getZoom() {
      return this.zoom;
    }
    getCenter() {
      return { lng: 116, lat: 40 };
    }
    getContainer() {
      return { clientWidth: 20000, clientHeight: 10000 };
    }
    project([lng, lat]: [number, number]) {
      return { x: lng * 100, y: lat * 100 };
    }
    addControl() {}
    easeTo = vi.fn();
    resize() {}
    remove() {
      this.listeners.clear();
    }
  }
  class TestMarker {
    element: HTMLElement;
    constructor({ element }: { element: HTMLElement }) {
      this.element = element;
    }
    setLngLat() {
      return this;
    }
    addTo(map: TestMap) {
      map.container.append(this.element);
      return this;
    }
    getElement() {
      return this.element;
    }
    remove() {
      this.element.remove();
    }
  }
  return { TestMap, TestMarker };
});
vi.mock("maplibre-gl", () => ({
  Map: sdk.TestMap,
  Marker: sdk.TestMarker,
  NavigationControl: class {},
  AttributionControl: class {},
  setWorkerUrl: vi.fn(),
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "",
}));
vi.mock("../src/infrastructure/tianditu", () => ({
  createTiandituStyle: () => ({}),
}));
vi.mock("../src/infrastructure/regionalBasemap", () => ({
  bindRegionalBasemap: () => ({ dispose: vi.fn(), isPending: () => false }),
}));

const data = atlasSchema.parse(catalog);
const scope = "artist:tang-yin";
const works = scopeWorks(data, scope);
function mount() {
  const props: ComponentProps<typeof AtlasMap> = {
    data,
    works,
    scope,
    historyKey: "test",
    compact: false,
    panel: false,
    focus: null,
    onFocusHandled: vi.fn(),
    onWork: vi.fn(),
    onVenue: vi.fn(),
    onVenueCollapse: vi.fn(),
    onOverview: vi.fn(),
    onList: vi.fn(),
  };
  const view = render(
    <StrictMode>
      <AtlasMap {...props} />
    </StrictMode>,
  );
  const map = sdk.TestMap.instances.at(-1)!;
  act(() => map.emit("load"));
  return { ...view, map, props };
}
function zoomTo(map: InstanceType<typeof sdk.TestMap>, zoom: number) {
  act(() => {
    map.zoom = zoom;
    map.emit("zoom");
    map.emit("zoomend");
    map.emit("moveend");
  });
}
beforeEach(() => {
  sdk.TestMap.instances = [];
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  useSession.setState({ cameras: { [scope]: { center: [116, 40], zoom: 7 } } });
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
  vi.unstubAllGlobals();
});

describe("map preview continuity", () => {
  it("keeps image nodes and keyboard focus through panning and zooming", () => {
    const { map } = mount();
    const button = screen.getByRole("button", { name: "查看王蜀宫妓图" });
    const image = button.querySelector("img");
    expect(image).not.toBeNull();
    button.focus();
    act(() => {
      map.bounds = [100, 20, 140, 55];
      map.emit("moveend");
    });
    expect(screen.getByRole("button", { name: "查看王蜀宫妓图" })).toBe(button);
    expect(document.activeElement).toBe(button);
    zoomTo(map, 7.5);
    expect(
      screen
        .getByRole("button", { name: "查看王蜀宫妓图" })
        .querySelector("img"),
    ).toBe(image);
    expect(document.activeElement).toBe(button);

    zoomTo(map, 9);
    const group = screen.getByRole("group", { name: "故宫博物院的作品" });
    expect(group.querySelectorAll("img").length).toBeGreaterThan(1);
    group.scrollTop = 100;
    zoomTo(map, 9.5);
    expect(screen.getByRole("group", { name: "故宫博物院的作品" })).toBe(group);
    expect(group.scrollTop).toBe(100);
    zoomTo(map, 8);
    expect(group.querySelectorAll("img")).toHaveLength(1);
    expect(group.querySelector("img")).toBe(image);
  });

  it("removes offscreen previews and still splits and merges clusters", () => {
    const { map, container, unmount } = mount();
    expect(
      screen.queryByRole("button", { name: "查看王蜀宫妓图" }),
    ).not.toBeNull();
    act(() => {
      map.bounds = [-10, -10, 10, 10];
      map.emit("moveend");
    });
    expect(container.querySelectorAll("[data-venue-id]")).toHaveLength(0);
    act(() => {
      map.bounds = [-180, -85, 180, 85];
      map.emit("moveend");
    });
    expect(
      screen.queryByRole("button", { name: "查看王蜀宫妓图" }),
    ).not.toBeNull();
    zoomTo(map, 1);
    expect(
      screen.queryAllByRole("button", { name: /幅作品，放大查看收藏地/ })
        .length,
    ).toBeGreaterThan(0);
    zoomTo(map, 11);
    expect(
      screen.queryAllByRole("button", { name: /幅作品，放大查看收藏地/ }),
    ).toHaveLength(0);
    expect(container.querySelectorAll("[data-venue-id]")).toHaveLength(6);
    const nodes = [...container.querySelectorAll("[data-venue-id]")];
    unmount();
    expect(nodes.every((node) => !node.isConnected)).toBe(true);
    expect(map.container.children).toHaveLength(0);
    expect(map.listeners.size).toBe(0);
  });

  it("refreshes selection and click handlers without replacing a retained preview", () => {
    const { props, rerender } = mount();
    const button = screen.getByRole("button", { name: "查看王蜀宫妓图" });
    const image = button.querySelector("img");
    const onWork = vi.fn();
    rerender(
      <StrictMode>
        <AtlasMap {...props} selected="tang-yin-01" onWork={onWork} />
      </StrictMode>,
    );
    expect(screen.getByRole("button", { name: "查看王蜀宫妓图" })).toBe(button);
    expect(button.querySelector("img")).toBe(image);
    fireEvent.click(button);
    expect(onWork).toHaveBeenCalledWith("tang-yin-01");
    expect(props.onWork).not.toHaveBeenCalled();
  });

  it("keeps nearby museums collapsed, opens only the chosen one, and remembers a manual close", () => {
    const { map, props, rerender, container } = mount();
    map.project = () => ({ x: 500, y: 400 });
    zoomTo(map, 11);
    expect(container.querySelectorAll('[data-expanded="true"]')).toHaveLength(
      0,
    );
    const selected = { ...props, expandedVenue: "palace-beijing" };
    rerender(
      <StrictMode>
        <AtlasMap {...selected} />
      </StrictMode>,
    );
    expect(container.querySelectorAll('[data-expanded="true"]')).toHaveLength(
      1,
    );
    expect(
      container
        .querySelector('[data-venue-id="palace-beijing"]')
        ?.getAttribute("data-expanded"),
    ).toBe("true");
    fireEvent.click(
      screen.getByRole("button", { name: "收起故宫博物院的作品" }),
    );
    expect(props.onVenueCollapse).toHaveBeenCalledOnce();
    rerender(
      <StrictMode>
        <AtlasMap {...props} />
      </StrictMode>,
    );
    // Even after the neighbouring museums leave view, an explicit close wins.
    map.project = ([lng, lat]) => ({ x: lng * 100, y: lat * 100 });
    zoomTo(map, 12);
    expect(
      container
        .querySelector('[data-venue-id="palace-beijing"]')
        ?.getAttribute("data-expanded"),
    ).toBe("false");
    fireEvent.click(
      screen.getByRole("button", { name: /故宫博物院，当前范围.*展开作品/ }),
    );
    expect(props.onVenue).toHaveBeenCalledWith("palace-beijing");
    rerender(
      <StrictMode>
        <AtlasMap {...selected} />
      </StrictMode>,
    );
    expect(
      container
        .querySelector('[data-venue-id="palace-beijing"]')
        ?.getAttribute("data-expanded"),
    ).toBe("true");
    rerender(
      <StrictMode>
        <AtlasMap {...props} expandedVenue="shanghai-museum" />
      </StrictMode>,
    );
    expect(container.querySelectorAll('[data-expanded="true"]')).toHaveLength(
      1,
    );
    expect(
      container
        .querySelector('[data-venue-id="shanghai-museum"]')
        ?.getAttribute("data-expanded"),
    ).toBe("true");
  });

  it("can close an automatically opened museum without changing the route or reopening on resize", () => {
    const { map, props, container } = mount();
    zoomTo(map, 9);
    fireEvent.click(
      screen.getByRole("button", { name: "收起故宫博物院的作品" }),
    );
    expect(props.onVenueCollapse).not.toHaveBeenCalled();
    act(() => map.emit("resize"));
    zoomTo(map, 10);
    expect(
      container
        .querySelector('[data-venue-id="palace-beijing"]')
        ?.getAttribute("data-expanded"),
    ).toBe("false");
  });

  it("keeps a street-level zoom when opening another museum", () => {
    const { map, props, rerender } = mount();
    zoomTo(map, 15);
    rerender(
      <StrictMode>
        <AtlasMap
          {...props}
          historyKey="new-selection"
          expandedVenue="palace-beijing"
        />
      </StrictMode>,
    );
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 15 }),
    );
  });
});
