import { describe, expect, it } from "vitest";
import {
  collectionMuseums,
  collectionWorks,
  DEFAULT_FILTERS,
  detailSequence,
  filterWorks,
  sortWorks,
} from "../src/lib/catalog";
import {
  FAVORITES_KEY,
  LEGACY_FAVORITES_KEY,
  parseFavorites,
  readFavorites,
} from "../src/lib/favorites";
import { clusterMuseums } from "../src/lib/map";
import catalogJson from "../public/data.json";
import registryJson from "../public/collections.json";
import type { Catalog, CollectionRegistry, Museums } from "../src/types";

const data = catalogJson as Catalog;
const registry = registryJson as CollectionRegistry;

describe("catalog filtering and navigation", () => {
  it("combines country, theme and attribution without changing the source", () => {
    const works = filterWorks(
      data.works,
      data.museums,
      { ...DEFAULT_FILTERS, country: "法国", theme: "肖像", kind: "馆方署名" },
      new Set(),
      data.artists,
    );
    expect(works.map((work) => work.id)).toEqual(["mona", "ferronniere"]);
    expect(data.works).toHaveLength(21);
  });

  it("searches artist names, museums and English titles", () => {
    for (const query of [" Mona Lisa ", "卢浮宫", "韦罗基奥"]) {
      expect(
        filterWorks(
          data.works,
          data.museums,
          { ...DEFAULT_FILTERS, query },
          new Set(),
          data.artists,
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(
      filterWorks(
        data.works,
        data.museums,
        { ...DEFAULT_FILTERS, artist: "verrocchio" },
        new Set(),
      ),
    ).toEqual([data.works.find((work) => work.id === "baptism")]);
  });

  it("preserves unknown location works and an empty favorites result", () => {
    expect(
      filterWorks(
        data.works,
        data.museums,
        { ...DEFAULT_FILTERS, country: "位置未确认" },
        new Set(),
      ).map((work) => work.id),
    ).toEqual(["salvator"]);
    expect(
      filterWorks(
        data.works,
        data.museums,
        { ...DEFAULT_FILTERS, favoritesOnly: true },
        new Set(),
      ),
    ).toEqual([]);
  });

  it("sorts copies and keeps detail navigation valid after removing the last favorite", () => {
    const before = data.works.map((work) => work.id);
    const sorted = sortWorks(data.works, data.museums, "date");
    expect(sorted[0].id).toBe("baptism");
    expect(data.works.map((work) => work.id)).toEqual(before);
    expect(detailSequence("mona", [], data.works)).toBe(data.works);
    const one = data.works.filter((work) => work.id === "mona");
    expect(detailSequence("mona", one, data.works)).toBe(one);
  });
});

describe("series composition", () => {
  it("supports non-European subjects and dates before the year 1000", () => {
    const early = {
      ...data.works[0],
      id: "test-early",
      date: "约960—975年",
      kind: "传世绘画",
    };
    const undated = {
      ...data.works[0],
      id: "test-undated",
      date: "年代未确认",
    };
    const explicit = {
      ...early,
      id: "test-explicit",
      date: "唐代",
      startYear: 700,
    };
    expect(
      sortWorks([undated, early, explicit], data.museums, "date").map(
        (work) => work.id,
      ),
    ).toEqual(["test-explicit", "test-early", "test-undated"]);
  });
  it("lets one work belong to multiple ordered topics without cloning its data", () => {
    const original = registry.collections[0];
    const second = {
      ...original,
      id: "test-portraits",
      workIds: ["ermine", "mona"],
    };
    const selection = collectionWorks(second, data.works);
    expect(selection.map((work) => work.id)).toEqual(["ermine", "mona"]);
    expect(selection[1]).toBe(collectionWorks(original, data.works)[0]);
    expect(Object.keys(collectionMuseums(selection, data.museums))).toEqual([
      "krakow",
      "louvre",
    ]);
  });

  it("does not leak another topic’s works or museum counts", () => {
    const topic = { ...registry.collections[0], workIds: ["salvator"] };
    const selection = collectionWorks(topic, data.works);
    expect(selection).toHaveLength(1);
    expect(collectionMuseums(selection, data.museums)).toEqual({});
  });
});

describe("favorites storage compatibility", () => {
  it("imports legacy favorites while preferring an explicitly empty series collection", () => {
    const values = new Map([[LEGACY_FAVORITES_KEY, '["mona"]']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    expect([...readFavorites(storage)]).toEqual(["mona"]);
    values.set(FAVORITES_KEY, "[]");
    expect(readFavorites(storage).size).toBe(0);
  });
  it("reads the previous version’s favorites and tolerates corrupt storage", () => {
    expect([...parseFavorites('["mona","ermine","mona"]')]).toEqual([
      "mona",
      "ermine",
    ]);
    for (const value of [null, "broken", "null", "42", '{"mona":true}'])
      expect(parseFavorites(value).size).toBe(0);
    expect([...parseFavorites('["mona",42,null]')]).toEqual(["mona"]);
  });
});

describe("map clusters", () => {
  it("groups close institutions, splits them when zoomed, and omits filtered-out works", () => {
    const museums: Museums = {
      louvre: data.museums.louvre,
      uffizi: {
        ...data.museums.uffizi,
        lat: data.museums.louvre.lat + 1,
        lng: data.museums.louvre.lng + 1,
      },
    };
    const works = data.works.filter((work) =>
      ["mona", "annunciation"].includes(work.id),
    );
    expect(
      clusterMuseums(museums, works, (lat, lng) => ({ x: lat, y: lng })),
    ).toHaveLength(1);
    expect(
      clusterMuseums(museums, works, (lat, lng) => ({
        x: lat * 100,
        y: lng * 100,
      })),
    ).toHaveLength(2);
    expect(
      clusterMuseums(museums, works.slice(0, 1), (lat, lng) => ({
        x: lat,
        y: lng,
      }))[0].ids,
    ).toEqual(["louvre"]);
    expect(
      clusterMuseums(museums, [], (lat, lng) => ({ x: lat, y: lng })),
    ).toEqual([]);
  });
});
