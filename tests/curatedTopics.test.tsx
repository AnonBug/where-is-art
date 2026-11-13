// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../public/catalog.json";
import curated from "../content/curated-topics.json";
import {
  atlasSchema,
  scopeWorks,
  scopeVenues,
  primaryImage,
} from "../src/domain/atlas";
import { ArtworkList, Catalog } from "../src/features/catalog/Catalog";
import { useSession } from "../src/application/session";

const data = atlasSchema.parse(catalog);
afterEach(cleanup);

describe("curated topics", () => {
  it("uses each Chinese artist's actual period in the expanded signature list", () => {
    render(
      <ArtworkList
        data={data}
        works={scopeWorks(data, "topic:signature")}
        scrollKey="test-signature"
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /送子天王图.*吴道子.*唐/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /秋风纨扇图.*唐寅.*明/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /吴道子.*明/ })).toBeNull();
  });
  it("keeps every curated entry reachable in its intended order with a whole image", () => {
    for (const topic of curated.topics) {
      const works = scopeWorks(data, `topic:${topic.id}`);
      expect(works.map((work) => work.id)).toEqual(topic.artworkIds);
      expect(new Set(topic.artworkIds).size).toBe(topic.artworkIds.length);
      for (const work of works)
        expect(primaryImage(data, work.id)?.role).toBe("whole");
    }
  });

  it("covers each independently represented artist once and preserves the original signature choices", () => {
    const works = scopeWorks(data, "topic:signature");
    expect(works.slice(0, 2).map((work) => work.id)).toEqual([
      "tang-yin-06",
      "mona",
    ]);
    expect(works.every((work) => work.artistIds.length === 1)).toBe(true);
    const artists = works.flatMap((work) => work.artistIds);
    expect(new Set(artists).size).toBe(artists.length);
    expect([...artists].sort()).toEqual(
      data.artists
        .filter((artist) => artist.id !== "verrocchio")
        .map((artist) => artist.id)
        .sort(),
    );
    expect(
      works.find((work) => work.artistIds[0] === "wang-wei")?.note,
    ).toContain("实际作者为佚名宋人");
  });

  it("separates the artist series and excludes disputed portraits and unrelated sunflower scenes", () => {
    for (const [id, artist] of [
      ["rembrandt-self-portraits", "rembrandt"],
      ["monet-water-lilies", "monet"],
      ["van-gogh-sunflowers", "van-gogh"],
    ]) {
      const works = scopeWorks(data, `topic:${id}`);
      expect(
        works.every(
          (work) => work.artistIds.length === 1 && work.artistIds[0] === artist,
        ),
      ).toBe(true);
    }
    const portraits = scopeWorks(data, "topic:rembrandt-self-portraits");
    expect(
      portraits.every((work) => !work.note.includes("作者归属存在限定")),
    ).toBe(true);
    const years = portraits.map((work) =>
      Number(work.dateLabel.match(/\d{4}/)?.[0]),
    );
    expect(years).toEqual([...years].sort((a, b) => a - b));
    const flowers = scopeWorks(data, "topic:van-gogh-sunflowers").map(
      (work) => work.id,
    );
    for (const id of curated.curation["van-gogh-sunflowers"].excludedArtworkIds)
      expect(flowers).not.toContain(id);
  });

  it("keeps Danae versions distinct and leaves unmapped works accessible in the list", () => {
    const works = scopeWorks(data, "topic:danae");
    expect(new Set(works.flatMap((work) => work.artistIds))).toEqual(
      new Set(["titian", "rembrandt"]),
    );
    expect(
      works.filter((work) => work.artistIds.includes("titian")),
    ).toHaveLength(5);
    const apsley = works.find((work) => work.id === "titian-q124940185")!;
    const prado = works.find((work) => work.id === "titian-q14425553")!;
    expect(apsley).not.toBe(prado);
    expect(apsley.dateLabel).not.toEqual(prado.dateLabel);
    expect(scopeVenues(data, [apsley])).toEqual([]);
    expect(scopeVenues(data, [prado]).map((venue) => venue.name)).toContain(
      "普拉多博物馆",
    );
  });

  it("labels same-title topic rows with their collections and selects the correct artwork ID", () => {
    useSession.setState({ tab: "topics", scroll: {} });
    const onWork = vi.fn();
    render(
      <Catalog
        data={data}
        scope="topic:danae"
        topicId="danae"
        compact
        onWork={onWork}
        onTab={vi.fn()}
        onArtist={vi.fn()}
        onTopic={vi.fn()}
        onBack={vi.fn()}
        onMap={vi.fn()}
      />,
    );
    const rows = within(screen.getByLabelText("作品列表"));
    expect(rows.getAllByRole("button")).toHaveLength(6);
    const prado = rows.getByRole("button", {
      name: /达娜厄.*提香.*普拉多博物馆/,
    });
    fireEvent.click(prado);
    expect(onWork.mock.calls[0][0].id).toBe("titian-q14425553");
    expect(
      rows.getByRole("button", { name: /达娜厄.*伦勃朗.*艾尔米塔什/ }),
    ).toBeTruthy();
  });
});
