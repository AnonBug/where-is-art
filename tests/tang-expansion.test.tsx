// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import catalog from "../public/catalog.json";
import sources from "../content/tang-expansion-sources.json";
import {
  atlasSchema,
  primaryImage,
  scopeWorks,
  scopeVenues,
  validateRelations,
  workVenues,
} from "../src/domain/atlas";
import { ArtworkDetails } from "../src/features/artworks/ArtworkDetails";
import ArtworkViewer from "../src/features/viewer/ArtworkViewer";
vi.mock("openseadragon", () => ({ default: vi.fn() }));
const data = atlasSchema.parse(catalog);
afterEach(cleanup);

describe("Wang Wei and Yan Liben collection", () => {
  it("retains all researched records and all 265 images with attribution evidence", () => {
    expect(
      data.artworks.filter((work) => work.artistIds.includes("wang-wei")),
    ).toHaveLength(21);
    expect(
      data.artworks.filter((work) => work.artistIds.includes("yan-liben")),
    ).toHaveLength(17);
    const visibleWangWei = scopeWorks(data, "artist:wang-wei");
    expect(visibleWangWei).toHaveLength(15);
    expect(scopeWorks(data, "artist:yan-liben")).toHaveLength(16);
    expect(scopeWorks(data, "category:china")).toHaveLength(50);
    expect(
      scopeVenues(data, visibleWangWei).some(
        (venue) => venue.id === "honolulu",
      ),
    ).toBe(false);
    expect(visibleWangWei.every((work) => primaryImage(data, work.id))).toBe(
      true,
    );
    for (const source of sources.works) {
      const work = data.artworks.find((work) => work.id === source.id)!;
      expect(work.dateLabel).toContain(source.displayArtist);
      expect(work.note).toContain(source.attributionNote);
      expect(
        data.images.filter((image) => image.artworkId === source.id),
      ).toHaveLength(source.imageCount);
      expect(workVenues(data, work.id)).toHaveLength(1);
    }
    for (const source of sources.images) {
      const image = data.images.find((image) => image.id === source.id)!;
      expect(image.sourceHash).toBe(source.sourceHash);
      expect(image.role).toBe(source.role);
    }
    expect(validateRelations(data)).toEqual([]);
  });
  it("reuses existing Taipei and Chicago venue IDs", () => {
    expect(workVenues(data, "wang-wei-wangchuan")[0].id).toBe("palace-taipei");
    expect(workVenues(data, "wang-wei-chicago")[0].id).toBe("artic");
    expect(
      data.venues.some((venue) => ["npm-taipei", "chicago"].includes(venue.id)),
    ).toBe(false);
  });
  it("keeps records without photos readable without an empty zoom action", () => {
    const missing = data.artworks.filter(
      (work) =>
        work.imageStatus === "unavailable" &&
        work.artistIds.some((id) => ["wang-wei", "yan-liben"].includes(id)),
    );
    expect(missing).toHaveLength(7);
    const work = missing[0];
    expect(primaryImage(data, work.id)).toBeUndefined();
    render(
      <ArtworkDetails
        data={data}
        work={work}
        onView={vi.fn()}
        onVenue={vi.fn()}
      />,
    );
    expect(
      screen.getByText("暂无可用图像，可查看作品资料与收藏位置。"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /放大欣赏/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^下载/ })).toBeNull();
  });
  it("shows an explicit empty state when a no-image viewer URL is opened directly", () => {
    const work = data.artworks.find(
      (work) => work.imageStatus === "unavailable",
    )!;
    render(
      <ArtworkViewer
        data={data}
        work={work}
        compact={false}
        infoOpen={false}
        onBack={vi.fn()}
        onInfo={vi.fn()}
        onAsset={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("暂无可用图像");
    expect(screen.queryByText("正在加载画作细节…")).toBeNull();
    expect(screen.queryByRole("button", { name: "放大画作" })).toBeNull();
  });
  it("does not label partial scroll photographs as whole scrolls", () => {
    const work = data.artworks.find((work) => work.id === "wang-wei-kyoto")!;
    expect(primaryImage(data, work.id)?.role).toBe("reference");
    render(
      <ArtworkDetails
        data={data}
        work={work}
        onView={vi.fn()}
        onVenue={vi.fn()}
      />,
    );
    expect(
      screen.getByText("当前展示参考图，图像类型及其与原作的关系见下方说明。"),
    ).toBeTruthy();
  });
  it("rejects accidental missing primary images or contradictory availability", () => {
    const copy = structuredClone(data);
    const id = "wang-wei-kyoto";
    copy.images = copy.images.filter(
      (image) => !(image.artworkId === id && image.role === "reference"),
    );
    expect(validateRelations(copy).some((error) => error.includes(id))).toBe(
      true,
    );
    const available = structuredClone(data);
    available.artworks.find((work) => work.id === id)!.imageStatus =
      "unavailable";
    expect(
      validateRelations(available).some((error) => error.includes(id)),
    ).toBe(true);
  });
});
