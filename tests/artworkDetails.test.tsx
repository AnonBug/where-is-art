// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import catalog from "../public/catalog.json";
import { atlasSchema, type Artwork } from "../src/domain/atlas";
import { ArtworkDetails } from "../src/features/artworks/ArtworkDetails";

const data = atlasSchema.parse(catalog);
const rochefort = data.artworks.find((work) => work.id === "manet-q3205630")!;
function show(work: Artwork) {
  return render(
    <ArtworkDetails
      data={data}
      work={work}
      showPreview={false}
      onVenue={vi.fn()}
    />,
  );
}
afterEach(cleanup);

it("shows known facts without filling missing interpretation, and keeps audit notes collapsed", () => {
  show(rochefort);
  expect(
    screen.getByRole("heading", { name: "Rochefort's Escape" }),
  ).toBeTruthy();
  expect(screen.getByText("1955/0009")).toBeTruthy();
  expect(screen.getByText("369")).toBeTruthy();
  expect(screen.getByText("油彩、帆布")).toBeTruthy();
  expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  const provenance = screen.getByText(rochefort.note).closest("details");
  expect(provenance).not.toBeNull();
  expect(provenance?.hasAttribute("open")).toBe(false);
});

it("does not display old cached contextual copy or placeholder facts", () => {
  const { container } = show({
    ...rochefort,
    dateLabel: "年代待核实",
    medium: "媒材待核实",
    guide: {
      scope: "contextual",
      background: "通用背景",
      story: "通用人物说明",
      looking: ["先看整个画幅"],
      scopeNote: "资料不足的模板说明",
      sources: [{ label: "通用参考", url: rochefort.sourceUrl }],
    },
  });
  for (const text of [
    "通用背景",
    "通用人物说明",
    "先看整个画幅",
    "资料不足的模板说明",
    "年代待核实",
    "媒材待核实",
    "解读参考",
  ])
    expect(screen.queryByText(text)).toBeNull();
  expect(
    [...container.querySelectorAll("p")].every((p) => p.textContent?.trim()),
  ).toBe(true);
});

it("renders only the populated sections of a sourced individual guide", () => {
  const venus = data.artworks.find(
    (work) => work.id === "titian-venus-urbino",
  )!;
  show({ ...venus, guide: { ...venus.guide!, story: undefined, looking: [] } });
  expect(screen.getByRole("heading", { name: "作品背景" })).toBeTruthy();
  expect(screen.getByText(venus.guide!.background!)).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "人物与题材" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "怎么看这幅画" })).toBeNull();
  expect(screen.getByText("解读参考")).toBeTruthy();
});

it("preserves an existing work-specific guide and its source", () => {
  const venus = data.artworks.find(
    (work) => work.id === "titian-venus-urbino",
  )!;
  show(venus);
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  expect(screen.getByText(venus.guide!.story!)).toBeTruthy();
  expect(
    screen.getByText(venus.guide!.sources[0].label).getAttribute("href"),
  ).toBe(venus.guide!.sources[0].url);
});
