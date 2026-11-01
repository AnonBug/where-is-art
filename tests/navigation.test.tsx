// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import catalog from "../public/catalog.json";
import { atlasSchema, type Artwork } from "../src/domain/atlas";
import { useSession } from "../src/application/session";
import { AtlasApp } from "../src/app/AtlasApp";

const device = vi.hoisted(() => ({ compact: false }));
const data = atlasSchema.parse(catalog);
vi.mock("../src/infrastructure/useContent", () => ({
  useContent: () => ({ data, error: "", retry: vi.fn() }),
}));
vi.mock("../src/platform/usePlatform", () => ({
  useCompact: () => device.compact,
  useOrientation: () => ({ landscape: false, notice: "", toggle: vi.fn() }),
}));
vi.mock("../src/features/map/AtlasMap", () => ({
  default: ({
    works,
    onWork,
    onVenue,
    onVenueCollapse,
    onOverview,
    expandedVenue,
    onCanvasInteraction,
  }: {
    works: Artwork[];
    onWork: (id: string) => void;
    onVenue: (id: string) => void;
    onVenueCollapse: () => void;
    onOverview: () => void;
    expandedVenue?: string;
    onCanvasInteraction?: () => void;
  }) => (
    <div aria-label="测试地图">
      <canvas
        aria-label="测试地图画布"
        onPointerDownCapture={onCanvasInteraction}
        onWheelCapture={onCanvasInteraction}
      />
      <span>地图作品数：{works.length}</span>
      <button onClick={() => onWork(works[0].id)}>地图缩略图</button>
      <button onClick={() => onVenue("palace-beijing")}>地图博物馆</button>
      <button onClick={onVenueCollapse}>缩小至区域地图</button>
      <button onClick={onOverview}>地图整体分布</button>
      <output data-testid="expanded-venue">{expandedVenue}</output>
    </div>
  ),
}));
vi.mock("../src/features/viewer/ArtworkViewer", () => ({
  default: ({
    infoOpen,
    onInfo,
    onBack,
    onCanvasInteraction,
  }: {
    infoOpen: boolean;
    onInfo: () => void;
    onBack: () => void;
    onCanvasInteraction?: () => void;
  }) => (
    <div data-info-open={infoOpen} aria-label="测试看画器" data-testid="viewer">
      <canvas
        aria-label="测试画作画布"
        onPointerDownCapture={onCanvasInteraction}
        onWheelCapture={onCanvasInteraction}
      />
      <button onClick={onInfo}>查看作品信息</button>
      <button onClick={onBack}>退出看画</button>
    </div>
  ),
}));
function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="route">
        {location.pathname}
        {location.search}
      </output>
      <button onClick={() => navigate(-1)}>浏览器后退</button>
    </>
  );
}
function mount(path = "/catalog/china?scope=category:china") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AtlasApp />
      <NavigationProbe />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  useSession.setState({
    tab: "china",
    topicId: null,
    collapsed: false,
    expanded: { china: "ming", foreign: "renaissance" },
    scroll: {},
    cameras: {},
    imageViews: {},
  });
  device.compact = false;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("navigation contracts", () => {
  it.each([false, true])(
    "clears museum expansion without remounting the map and keeps it collapsed after viewing a work (compact=%s)",
    async (compact) => {
      device.compact = compact;
      const user = userEvent.setup();
      mount(
        "/map?scope=artist:tang-yin&venue=palace-beijing&artwork=tang-yin-02",
      );
      const canvas = await screen.findByLabelText("测试地图画布");
      await user.click(screen.getByRole("button", { name: "缩小至区域地图" }));
      expect(screen.getByLabelText("测试地图画布")).toBe(canvas);
      expect(screen.getByTestId("expanded-venue").textContent).toBe("");
      expect(screen.getByTestId("route").textContent).toBe(
        "/map?scope=artist%3Atang-yin&artwork=tang-yin-02",
      );
      await user.click(screen.getByRole("button", { name: "地图缩略图" }));
      await user.click(
        await screen.findByRole("button", {
          name: compact ? "退出看画" : "关闭详情",
        }),
      );
      expect(await screen.findByLabelText("测试地图")).toBeTruthy();
      expect(screen.getByTestId("expanded-venue").textContent).toBe("");
      expect(screen.getByTestId("route").textContent).not.toContain("venue=");
    },
  );
  it.each([false, true])(
    "dismisses painting information on the first pointer down without consuming the gesture or adding a Back step (compact=%s)",
    async (compact) => {
      device.compact = compact;
      const user = userEvent.setup();
      mount(
        "/artworks/tang-yin-02/view?scope=artist:tang-yin&asset=tang-yin-02-whole",
      );
      const canvas = await screen.findByLabelText("测试画作画布");
      await user.click(screen.getByRole("button", { name: "查看作品信息" }));
      const info = screen.getByRole("dialog", { name: "作品信息" });
      fireEvent.pointerDown(
        within(info).getByRole("heading", { name: "事茗图卷" }),
      );
      fireEvent.wheel(info, { deltaY: 100 });
      expect(screen.getByRole("dialog", { name: "作品信息" })).toBe(info);
      const press = createEvent.pointerDown(canvas, {
        bubbles: true,
        cancelable: true,
        pointerType: compact ? "touch" : "mouse",
      });
      fireEvent(canvas, press);
      expect(press.defaultPrevented).toBe(false);
      expect(screen.queryByRole("dialog", { name: "作品信息" })).toBeNull();
      expect(screen.getByLabelText("测试画作画布")).toBe(canvas);
      expect(screen.getByTestId("route").textContent).toContain(
        "asset=tang-yin-02-whole",
      );
      fireEvent.pointerMove(canvas, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(canvas);
      await user.click(screen.getByRole("button", { name: "退出看画" }));
      expect(screen.getByTestId("route").textContent).toContain("/map?");
    },
  );
  it.each([false, true])(
    "dismisses map information on pointer down while keeping its canvas and museum context (compact=%s)",
    async (compact) => {
      device.compact = compact;
      mount("/artworks/tang-yin-02?scope=artist:tang-yin&venue=palace-beijing");
      const canvas = await screen.findByLabelText("测试地图画布");
      fireEvent.pointerDown(canvas, {
        pointerType: compact ? "touch" : "mouse",
      });
      expect(screen.queryByRole("dialog", { name: "作品信息" })).toBeNull();
      expect(screen.getByLabelText("测试地图画布")).toBe(canvas);
      expect(screen.getByTestId("route").textContent).toBe(
        "/map?scope=artist%3Atang-yin&venue=palace-beijing",
      );
    },
  );
  it.each([false, true])(
    "keeps the painting mounted under its information overlay without a second view action (compact=%s)",
    async (compact) => {
      device.compact = compact;
      const user = userEvent.setup();
      mount(
        "/artworks/tang-yin-02/view?scope=artist:tang-yin&venue=palace-beijing&asset=tang-yin-02-whole",
      );
      const viewer = await screen.findByTestId("viewer");
      await user.click(screen.getByRole("button", { name: "查看作品信息" }));
      const info = screen.getByRole("dialog", { name: "作品信息" });
      expect(screen.getByTestId("viewer")).toBe(viewer);
      expect(viewer.hidden).toBe(false);
      expect(viewer.hasAttribute("inert")).toBe(false);
      expect(
        within(info).queryByRole("button", { name: /放大欣赏/ }),
      ).toBeNull();
      expect(within(info).queryByText("放大欣赏")).toBeNull();
      expect(screen.getByTestId("route").textContent).toContain(
        "asset=tang-yin-02-whole",
      );
      await user.click(screen.getByRole("button", { name: "关闭作品信息" }));
      expect(screen.queryByRole("dialog", { name: "作品信息" })).toBeNull();
      expect(screen.getByTestId("viewer")).toBe(viewer);
      expect(viewer.hasAttribute("inert")).toBe(false);
      expect(screen.getByTestId("route").textContent).toContain(
        "venue=palace-beijing",
      );
      await user.click(screen.getByRole("button", { name: "查看作品信息" }));
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "作品信息" })).toBeNull();
    },
  );
  it("keeps the map behind compact artwork information with a working view action", async () => {
    device.compact = true;
    const user = userEvent.setup();
    mount("/artworks/tang-yin-02?scope=artist:tang-yin");
    expect(await screen.findByLabelText("测试地图")).toBeTruthy();
    const info = screen.getByRole("dialog", { name: "作品信息" });
    await user.click(
      within(info).getByRole("button", { name: "放大欣赏事茗图卷" }),
    );
    expect(await screen.findByTestId("viewer")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "作品信息" })).toBeNull();
  });
  it("closes a directly opened information overlay back to the same painting asset", async () => {
    const user = userEvent.setup();
    mount(
      "/artworks/tang-yin-02/view/info?scope=artist:tang-yin&venue=palace-beijing&asset=tang-yin-02-whole",
    );
    await screen.findByTestId("viewer");
    await user.click(screen.getByRole("button", { name: "关闭作品信息" }));
    expect(screen.getByTestId("route").textContent).toBe(
      "/artworks/tang-yin-02/view?scope=artist%3Atang-yin&venue=palace-beijing&asset=tang-yin-02-whole",
    );
  });
  it.each([false, true])(
    "opens museums on the map and restores their expansion after viewing a work (compact=%s)",
    async (compact) => {
      device.compact = compact;
      const user = userEvent.setup();
      mount("/map?scope=artist:tang-yin");
      await user.click(
        await screen.findByRole("button", { name: "地图博物馆" }),
      );
      expect(screen.getByTestId("route").textContent).toContain("/map?");
      expect(screen.getByTestId("expanded-venue").textContent).toBe(
        "palace-beijing",
      );
      expect(screen.queryByRole("button", { name: "关闭详情" })).toBeNull();
      expect(screen.queryByRole("button", { name: "返回上一页" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "地图缩略图" }));
      await user.click(
        await screen.findByRole("button", {
          name: compact ? "退出看画" : "关闭详情",
        }),
      );
      expect(await screen.findByLabelText("测试地图")).toBeTruthy();
      expect(screen.getByTestId("expanded-venue").textContent).toBe(
        "palace-beijing",
      );
      await user.click(screen.getByRole("button", { name: "地图整体分布" }));
      expect(screen.getByTestId("expanded-venue").textContent).toBe("");
    },
  );
  it("redirects old museum list links to the expanded map", async () => {
    mount("/venues/palace-beijing?scope=artist:tang-yin");
    await waitFor(() =>
      expect(screen.getByTestId("route").textContent).toBe(
        "/map?scope=artist%3Atang-yin&venue=palace-beijing",
      ),
    );
    expect(await screen.findByTestId("expanded-venue")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭详情" })).toBeNull();
  });
  it("switches country scope without mixing works and returns through topic, detail and viewer", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "外国" }));
    expect(await screen.findByText("地图作品数：158")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "专题" }));
    await user.click(screen.getByRole("button", { name: /山水之间/ }));
    expect(await screen.findByText("地图作品数：10")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /事茗图卷\s*唐寅/ }));
    expect(screen.getByTestId("route").textContent).toContain(
      "/topics/landscape",
    );
    expect(screen.queryByRole("heading", { name: "作品信息" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "地图缩略图" }));
    await user.click(screen.getByRole("button", { name: "放大欣赏事茗图卷" }));
    expect(await screen.findByLabelText("测试看画器")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "查看作品信息" }));
    expect(screen.getByTestId("route").textContent).toContain("/view/info");
    await user.click(screen.getByRole("button", { name: "浏览器后退" }));
    await waitFor(() =>
      expect(screen.getByTestId("route").textContent).toContain("/view?"),
    );
    await user.click(screen.getByRole("button", { name: "退出看画" }));
    expect(screen.getByRole("heading", { name: "作品信息" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(screen.getByTestId("route").textContent).toContain(
      "/topics/landscape",
    );
  });
  it("opens a shared foreign artist map with the matching directory and period", async () => {
    mount("/map?scope=artist:monet");
    expect(await screen.findByText("地图作品数：6")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "外国" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("button", { name: /克洛德·莫奈/ })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /^印象派/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
  it("keeps compact catalog, map and viewer as separate full-screen scenes", async () => {
    device.compact = true;
    const user = userEvent.setup();
    mount();
    expect(screen.queryByLabelText("测试地图")).toBeNull();
    await user.click(screen.getByRole("button", { name: /唐寅\s*1470/ }));
    expect(await screen.findByLabelText("测试地图")).toBeTruthy();
    expect(screen.queryByLabelText("名画目录")).toBeNull();
    await user.click(screen.getByRole("button", { name: "地图缩略图" }));
    expect(await screen.findByLabelText("测试看画器")).toBeTruthy();
    expect(screen.queryByLabelText("测试地图")).toBeNull();
    await user.click(screen.getByRole("button", { name: "退出看画" }));
    expect(await screen.findByLabelText("测试地图")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "返回目录" }));
    expect(screen.getByLabelText("名画目录")).toBeTruthy();
  });
});
