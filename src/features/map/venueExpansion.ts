// Larger collections require an explicit choice, even at street-level zoom.
export const AUTO_EXPAND_WORK_LIMIT = 8;
const GAP = 16;

export interface VenueFootprint {
  id: string;
  x: number;
  y: number;
  count: number;
  cluster?: boolean;
}
interface Layout {
  width: number;
  height: number;
  windowHeight: number;
  compact: boolean;
  landscape: boolean;
}
interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Match the collection's CSS dimensions, including its header, pin and label.
function footprint(
  venue: VenueFootprint,
  layout: Layout,
  expanded: boolean,
): Rect {
  let width = venue.cluster ? 96 : 220;
  let height = venue.cluster ? 92 : 78;
  if (expanded) {
    const columns = Math.min(4, Math.ceil(Math.sqrt(venue.count)));
    const card = layout.compact ? 64 : 76;
    width = Math.max(220, columns * (card + 8) + 10);
    height =
      Math.min(
        Math.ceil(venue.count / columns) * (card + 33) + 8,
        Math.max(96, layout.windowHeight / 2 - 150),
      ) +
      52 +
      18;
    if (layout.landscape) {
      width = Math.max(220, Math.min(venue.count * 72 + 10, layout.width - 70));
      height = 97 + 8 + 52 + 18;
    }
  }
  return {
    left: venue.x - width / 2,
    right: venue.x + width / 2,
    top: venue.y - height,
    bottom: venue.y + (venue.cluster ? 32 : 58),
  };
}
function overlaps(a: Rect, b: Rect) {
  return (
    a.left < b.right + GAP &&
    a.right + GAP > b.left &&
    a.top < b.bottom + GAP &&
    a.bottom + GAP > b.top
  );
}

export function autoExpandedVenues(venues: VenueFootprint[], layout: Layout) {
  const eligible = (venue: VenueFootprint) =>
    !venue.cluster && venue.count > 1 && venue.count <= AUTO_EXPAND_WORK_LIMIT;
  const rectangles = venues.map((venue) =>
    footprint(venue, layout, eligible(venue)),
  );
  return new Set(
    venues
      .filter((venue, index) => {
        if (!eligible(venue)) return false;
        const rect = rectangles[index];
        // Leave room for the map header and bottom controls as well as neighbouring museums.
        if (
          rect.left < GAP ||
          rect.right > layout.width - GAP ||
          rect.top < 70 ||
          rect.bottom > layout.height - 90
        )
          return false;
        return !rectangles.some(
          (other, otherIndex) => otherIndex !== index && overlaps(rect, other),
        );
      })
      .map((venue) => venue.id),
  );
}
