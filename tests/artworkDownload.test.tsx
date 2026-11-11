// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import catalog from "../public/catalog.json";
import { atlasSchema, assetUrl, primaryImage } from "../src/domain/atlas";
import { ArtworkDetails } from "../src/features/artworks/ArtworkDetails";
import userEvent from "@testing-library/user-event";

const data = atlasSchema.parse(catalog);
afterEach(cleanup);

it("omits the duplicate preview inside the viewer and keeps provenance collapsed until requested", async () => {
  const user = userEvent.setup();
  const work = data.artworks.find((work) => work.id === "titian-q572697")!;
  const { container, rerender } = render(
    <ArtworkDetails
      data={data}
      work={work}
      showPreview={false}
      onVenue={vi.fn()}
    />,
  );
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByRole("link", { name: /^下载/ })).toBeNull();
  const disclosure = container.querySelector("details")!;
  expect(disclosure.open).toBe(false);
  expect(
    screen.getByRole("link", { name: /图像来源/ }).closest("details"),
  ).toBe(disclosure);
  await user.click(screen.getByText("来源与版权"));
  expect(disclosure.open).toBe(true);
  expect(screen.getByRole("link", { name: /图像来源/ })).toBeTruthy();
  expect(
    screen.getByText("地图标示收藏机构，不代表作品正在展出。"),
  ).toBeTruthy();
  rerender(
    <ArtworkDetails
      data={data}
      work={data.artworks.find((w) => w.id === "mona")!}
      showPreview={false}
      onVenue={vi.fn()}
    />,
  );
  expect(container.querySelector("details")!.open).toBe(false);
});

it.each([
  ["mona", "下载原图", "assets/mona.jpg"],
  [
    "tang-yin-02",
    "下载全图（低清）",
    "media/tang-yin/tang-yin-02-whole/preview.webp",
  ],
])(
  "offers the correct downloadable image for %s in the information panel",
  (id, label, url) => {
    const work = data.artworks.find((work) => work.id === id)!;
    render(<ArtworkDetails data={data} work={work} onVenue={vi.fn()} />);
    const link = screen.getByRole("link", {
      name: `${label}：${work.title} · 全图`,
    });
    expect(link.getAttribute("href")).toBe(assetUrl(url));
    expect(link.getAttribute("download")).toBe(
      id === "mona" ? "蒙娜丽莎-全图-原图.jpg" : "事茗图卷-全图-低清预览.webp",
    );
  },
);

it("downloads the selected detail and rejects an asset belonging to a different work", () => {
  const work = data.artworks.find((work) => work.id === "tang-yin-11")!;
  const detail = data.images.find(
    (image) => image.id === "tang-yin-11-detail-05",
  )!;
  const { rerender } = render(
    <ArtworkDetails
      data={data}
      work={work}
      assetId={detail.id}
      onVenue={vi.fn()}
    />,
  );
  const link = screen.getByRole("link", { name: /^下载局部图/ });
  expect(link.getAttribute("href")).toBe(assetUrl(detail.delivery.url));
  expect(link.getAttribute("download")).toContain(detail.label);
  rerender(
    <ArtworkDetails
      data={data}
      work={work}
      assetId="mona-whole"
      onVenue={vi.fn()}
    />,
  );
  const whole = primaryImage(data, work.id)!;
  expect(screen.getByRole("link", { name: /^下载/ }).getAttribute("href")).toBe(
    assetUrl(
      whole.delivery.kind === "dzi" ? whole.preview.url : whole.delivery.url,
    ),
  );
});
