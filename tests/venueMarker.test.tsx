// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import catalog from "../public/catalog.json";
import { atlasSchema, scopeWorks, venueWorks } from "../src/domain/atlas";
import { VenueMarker } from "../src/features/map/VenueMarker";

afterEach(cleanup);
it("scrolls an expanded collection without passing gestures to the map and still opens artworks", () => {
  const data = atlasSchema.parse(catalog);
  const venue = data.venues.find((item) => item.id === "artic")!;
  const works = venueWorks(data, scopeWorks(data, "category:foreign"), [
    venue.id,
  ]);
  const mapGesture = vi.fn();
  const openWork = vi.fn();
  render(
    <div
      onWheel={mapGesture}
      onMouseDown={mapGesture}
      onTouchStart={mapGesture}
      onTouchMove={mapGesture}
    >
      <VenueMarker
        data={data}
        venue={venue}
        works={works}
        expanded
        showLabel
        onExpand={vi.fn()}
        onWork={openWork}
      />
    </div>,
  );
  const gallery = screen.getByRole("group", { name: `${venue.name}的作品` });
  const wheel = createEvent.wheel(gallery, {
    bubbles: true,
    cancelable: true,
    deltaY: 120,
  });
  fireEvent(gallery, wheel);
  fireEvent.mouseDown(gallery);
  fireEvent.touchStart(gallery);
  fireEvent.touchMove(gallery);
  expect(mapGesture).not.toHaveBeenCalled();
  expect(wheel.defaultPrevented).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: `查看${works[0].title}` }),
  );
  expect(openWork).toHaveBeenCalledWith(works[0].id);
});
