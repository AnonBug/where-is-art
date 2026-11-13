// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @ts-expect-error The shared Node import parser is plain JavaScript.
import { parseCsv } from "../scripts/lib/oss-csv.mjs";
import { atlasSchema, assetUrl, primaryImage } from "../src/domain/atlas";
import { ArtworkDetails } from "../src/features/artworks/ArtworkDetails";
import { ArtworkList } from "../src/features/catalog/Catalog";
import { artworkDownload } from "../src/domain/artworkDownload";

const rows: Record<string, string>[] = parseCsv(
  readFileSync("content/imports/oss-image-upgrades-2026-11-13.csv", "utf8"),
);
const data = atlasSchema.parse(
  JSON.parse(readFileSync("public/catalog.json", "utf8")),
);
afterEach(cleanup);

it("reconciles all 187 IDs, keeps each image role distinct, and preserves supplied provenance", () => {
  expect(rows).toHaveLength(187);
  expect(new Set(rows.map((row) => row["作品ID"])).size).toBe(187);
  // Absolute supplied URLs must remain valid even if an asset-base setting changes.
  vi.stubEnv("VITE_ASSET_BASE_URL", "https://example.test/unrelated/");
  try {
    for (const row of rows) {
      const work = data.artworks.find((work) => work.id === row["作品ID"])!;
      const image = primaryImage(data, work.id)!;
      expect(work.artistIds).toContain(row["画家"]);
      expect(assetUrl(image.delivery.url)).toBe(row["当前完整图"]);
      expect(assetUrl(image.preview.url)).toBe(row["预览图"]);
      expect(assetUrl(image.thumbnail.url)).toBe(row["缩略图"]);
      expect(
        new Set([image.delivery.url, image.preview.url, image.thumbnail.url])
          .size,
      ).toBe(3);
      expect(`${image.width}×${image.height}`).toBe(row["当前尺寸"]);
      expect(image.sourceUrl).toBe(row["来源文件页"]);
      expect(image.sourceImageUrl).toBe(row["原始来源地址"]);
      expect(image.credit).toBe(row["署名"]);
      expect(image.licenseLabel).toBe(row["许可"]);
      expect(image.licenseUrl).toBe(row["许可地址"]);
      expect(image.usageTerms).toBe(row["使用条件"]);
      expect(artworkDownload(work, image)?.href).toBe(row["当前完整图"]);
      expect(artworkDownload(work, image)?.label).toBe("下载图片");
    }
  } finally {
    vi.unstubAllEnvs();
  }
});

it.each(["raphael", "manet", "monet", "van-gogh", "gauguin", "mondrian"])(
  "uses the %s thumbnail in lists, preview in details, and full image for download",
  (artist) => {
    const row = rows.find((row) => row["画家"] === artist)!;
    const work = data.artworks.find((work) => work.id === row["作品ID"])!;
    const { container, rerender } = render(
      <ArtworkList
        data={data}
        works={[work]}
        onSelect={vi.fn()}
        scrollKey="image-update-test"
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      row["缩略图"],
    );
    rerender(<ArtworkDetails data={data} work={work} onVenue={vi.fn()} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      row["预览图"],
    );
    const download = screen.getByRole("link", { name: /^下载图片：/ });
    expect(download.getAttribute("href")).toBe(row["当前完整图"]);
    expect(download.getAttribute("download")).not.toContain("原图");
  },
);

it("exposes the single non-commercial resource's complete attribution, terms and source links", async () => {
  const restricted = rows.filter((row) =>
    /non-commercial|非商业/.test(row["许可"] + row["使用条件"]),
  );
  expect(restricted.map((row) => row["作品ID"])).toEqual([
    "mondrian-q24046283",
  ]);
  const row = restricted[0];
  const work = data.artworks.find((work) => work.id === row["作品ID"])!;
  const { container } = render(
    <ArtworkDetails data={data} work={work} onVenue={vi.fn()} />,
  );
  expect(container.querySelector("details")?.open).toBe(false);
  await userEvent.setup().click(screen.getByText("来源与版权"));
  expect(container.querySelector("details")?.open).toBe(true);
  expect(screen.getByText(row["署名"])).toBeTruthy();
  expect(screen.getByText(row["使用条件"])).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /图像来源/ }).getAttribute("href"),
  ).toBe(row["来源文件页"]);
  expect(
    screen.getByRole("link", { name: row["许可"] }).getAttribute("href"),
  ).toBe(row["许可地址"]);
});
