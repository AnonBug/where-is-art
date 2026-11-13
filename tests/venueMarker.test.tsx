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
        onCollapse={vi.fn()}
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

it("offers a dedicated close button and makes the pin and label toggle the collection", () => {
  const data = atlasSchema.parse(catalog);
  const venue = data.venues.find((item) => item.id === "artic")!;
  const works = venueWorks(data, scopeWorks(data, "category:foreign"), [
    venue.id,
  ]);
  const onExpand = vi.fn();
  const onCollapse = vi.fn();
  const props = {
    data,
    venue,
    works,
    showLabel: true,
    onExpand,
    onCollapse,
    onWork: vi.fn(),
  };
  const view = render(<VenueMarker {...props} expanded={false} />);
  expect(
    screen.queryByRole("button", { name: `收起${venue.name}的作品` }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /当前范围.*展开作品/ }));
  expect(onExpand).toHaveBeenCalledOnce();
  view.rerender(<VenueMarker {...props} expanded />);
  fireEvent.click(
    screen.getByRole("button", { name: `收起${venue.name}的作品` }),
  );
  fireEvent.click(screen.getByRole("button", { name: /当前范围.*收起作品/ }));
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`^${venue.name}.*· ${works.length}$`),
    }),
  );
  expect(onCollapse).toHaveBeenCalledTimes(3);
  expect(onExpand).toHaveBeenCalledOnce();
});
