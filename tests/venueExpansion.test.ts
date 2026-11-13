import { describe, expect, it } from "vitest";
import {
  autoExpandedVenues,
  type VenueFootprint,
} from "../src/features/map/venueExpansion";

const layout = {
  width: 1200,
  height: 900,
  windowHeight: 900,
  compact: false,
  landscape: false,
};
const venue = (id: string, x: number, y = 450, count = 8): VenueFootprint => ({
  id,
  x,
  y,
  count,
});

describe("museum expansion density", () => {
  it("automatically opens small isolated collections, but requires a click for more than eight works", () => {
    expect([
      ...autoExpandedVenues(
        [venue("small", 250), venue("large", 850, 450, 9)],
        layout,
      ),
    ]).toEqual(["small"]);
  });
  it("collapses both collections when their projected galleries overlap, even if their pins are apart", () => {
    expect(
      autoExpandedVenues([venue("a", 400), venue("b", 660)], layout).size,
    ).toBe(0);
    expect(
      autoExpandedVenues([venue("a", 250), venue("b", 850)], layout).size,
    ).toBe(2);
  });
  it("also avoids covering a collapsed large collection or an aggregated museum marker", () => {
    expect(
      autoExpandedVenues([venue("a", 400), venue("b", 450, 400, 11)], layout)
        .size,
    ).toBe(0);
    expect(
      autoExpandedVenues(
        [venue("a", 400), { ...venue("cluster", 450, 400), cluster: true }],
        layout,
      ).size,
    ).toBe(0);
  });
  it("allows vertically separated museums and excludes galleries cut off by map edges", () => {
    expect(
      autoExpandedVenues(
        [venue("a", 400, 400, 2), venue("b", 400, 750, 2)],
        layout,
      ).size,
    ).toBe(2);
    for (const item of [
      venue("left", 50),
      venue("right", 1150),
      venue("top", 500, 180),
      venue("bottom", 500, 850),
    ]) {
      expect(autoExpandedVenues([item], layout).size).toBe(0);
    }
  });
  it("respects mobile portrait and short landscape layouts", () => {
    expect(
      autoExpandedVenues([venue("a", 196, 440)], {
        ...layout,
        width: 393,
        height: 760,
        windowHeight: 852,
        compact: true,
      }).has("a"),
    ).toBe(true);
    expect(
      autoExpandedVenues([venue("a", 426, 250)], {
        ...layout,
        width: 852,
        height: 340,
        windowHeight: 393,
        compact: true,
        landscape: true,
      }).size,
    ).toBe(0);
  });
});
