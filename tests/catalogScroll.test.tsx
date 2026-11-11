// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../public/catalog.json";
import { atlasSchema } from "../src/domain/atlas";
import { useSession } from "../src/application/session";
import { Catalog } from "../src/features/catalog/Catalog";

const data = atlasSchema.parse(catalog);
function mount(compact = true) {
  return render(
    <Catalog
      data={data}
      scope="category:foreign"
      topicId={null}
      compact={compact}
      onTab={vi.fn()}
      onArtist={vi.fn()}
      onTopic={vi.fn()}
      onBack={vi.fn()}
      onMap={vi.fn()}
      onWork={vi.fn()}
    />,
  );
}
beforeEach(() => {
  useSession.setState({
    tab: "foreign",
    expanded: { foreign: "renaissance" },
    scroll: {},
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("mobile directory scroll anchoring", () => {
  it("shows the browsable painting count next to each artist", () => {
    mount();
    expect(screen.getByRole("button", { name: /提香.*369\s*幅/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /达·芬奇.*21\s*幅/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^巴洛克/ }));
    expect(
      screen.getByRole("button", { name: /伦勃朗.*350\s*幅/ }),
    ).toBeTruthy();
  });
  it("opens topics without a period expansion or a pending scroll target", () => {
    useSession.setState({ tab: "topics" });
    mount();
    expect(screen.getByText(data.topics[0].title)).toBeTruthy();
  });

  it("aligns the newly opened period using its position after the previous period collapses", () => {
    mount();
    const previous = screen.getByRole("button", { name: /^文艺复兴/ });
    const target = screen.getByRole("button", { name: /^巴洛克/ });
    const section = target.parentElement!;
    const directory = section.parentElement!;
    directory.scrollTop = 600;
    vi.spyOn(directory, "getBoundingClientRect").mockReturnValue({
      top: 150,
    } as DOMRect);
    vi.spyOn(section, "getBoundingClientRect").mockImplementation(() => {
      expect(previous.getAttribute("aria-expanded")).toBe("false");
      expect(target.getAttribute("aria-expanded")).toBe("true");
      return { top: -50 } as DOMRect;
    });
    // A sticky heading can already be at the top while its section starts above it.
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      top: 150,
    } as DOMRect);
    fireEvent.click(target);
    expect(directory.scrollTop).toBe(400);
    expect(screen.getByRole("button", { name: /卡拉瓦乔/ })).toBeTruthy();
  });

  it("restores a saved position on return and does not realign when closing a period", () => {
    useSession.setState({ scroll: { "catalog:foreign": 420 } });
    const view = mount();
    const heading = screen.getByRole("button", { name: /^文艺复兴/ });
    const directory = heading.parentElement!.parentElement!;
    expect(directory.scrollTop).toBe(420);
    fireEvent.click(heading);
    expect(directory.scrollTop).toBe(420);
    directory.scrollTop = 260;
    view.unmount();
    mount();
    expect(
      screen.getByRole("button", { name: /^文艺复兴/ }).parentElement!
        .parentElement!.scrollTop,
    ).toBe(260);
  });

  it("does not apply mobile scroll alignment on desktop", () => {
    mount(false);
    const target = screen.getByRole("button", { name: /^巴洛克/ });
    const directory = target.parentElement!.parentElement!;
    directory.scrollTop = 600;
    fireEvent.click(target);
    expect(target.getAttribute("aria-expanded")).toBe("true");
    expect(directory.scrollTop).toBe(600);
  });
});
