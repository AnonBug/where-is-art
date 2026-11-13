import { z } from "zod";

const resource = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
});
const delivery = z.discriminatedUnion("kind", [
  resource.extend({ kind: z.literal("image"), format: z.string() }),
  z.object({
    kind: z.literal("dzi"),
    url: z.string(),
    width: z.number(),
    height: z.number(),
    tileSize: z.number(),
    overlap: z.number(),
    tileCount: z.number(),
    totalBytes: z.number(),
    maxTileBytes: z.number(),
  }),
]);
export const imageSchema = z.object({
  id: z.string(),
  artworkId: z.string(),
  role: z.enum(["whole", "detail", "reference"]),
  label: z.string(),
  order: z.number(),
  width: z.number(),
  height: z.number(),
  thumbnail: resource,
  preview: resource,
  delivery,
  sourceUrl: z.string(),
  sourceImageUrl: z.string(),
  sourceHash: z.string(),
  credit: z.string(),
  licenseLabel: z.string().optional(),
  licenseUrl: z.string().optional(),
  usageTerms: z.string().optional(),
  quality: z.enum(["high", "standard"]),
  publicationStatus: z
    .enum(["cleared", "review-required"])
    .default("review-required"),
});
export const atlasSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  periods: z.array(
    z.object({
      id: z.string(),
      category: z.enum(["china", "foreign"]),
      name: z.string(),
      dateLabel: z.string(),
    }),
  ),
  artists: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.enum(["china", "foreign"]),
      periodId: z.string(),
      lifeLabel: z.string(),
      countryLabel: z.string(),
    }),
  ),
  artworks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      artistIds: z.array(z.string()),
      dateLabel: z.string(),
      medium: z.string(),
      catalogNumber: z.string().optional(),
      inventoryNumber: z.string().optional(),
      description: z.string(),
      sourceUrl: z.string(),
      note: z.string().default(""),
      guide: z
        .object({
          background: z.string().optional(),
          story: z.string().optional(),
          looking: z.array(z.string()).optional(),
          scope: z.enum(["individual", "contextual"]),
          scopeNote: z.string().optional(),
          sources: z
            .array(z.object({ label: z.string(), url: z.string().url() }))
            .min(1),
        })
        .optional(),
      imageStatus: z.literal("unavailable").optional(),
    }),
  ),
  venues: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      city: z.string(),
      country: z.string(),
      branch: z.string().optional(),
      coordinates: z.tuple([z.number(), z.number()]).nullable(),
      sourceUrl: z.string(),
      coordinateNote: z.string().optional(),
    }),
  ),
  holdings: z.array(
    z.object({
      artworkId: z.string(),
      venueId: z.string(),
      note: z.string(),
      verifiedAt: z.string(),
      sourceUrl: z.string(),
    }),
  ),
  topics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      artworkIds: z.array(z.string()),
    }),
  ),
  images: z.array(imageSchema),
});
export type Atlas = z.infer<typeof atlasSchema>;
export type Artwork = Atlas["artworks"][number];
export type Venue = Atlas["venues"][number];
export type ImageAsset = z.infer<typeof imageSchema>;
// Browsing needs only identifiers, captions, thumbnails and map relations.
// Reading and viewing a work loads its complete metadata separately.
export const browseAtlasSchema = atlasSchema.extend({
  artworks: z.array(
    atlasSchema.shape.artworks.element
      .pick({
        id: true,
        title: true,
        artistIds: true,
        imageStatus: true,
      })
      .extend({ id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/) }),
  ),
  images: z.array(
    imageSchema.pick({ id: true, artworkId: true, role: true }).extend({
      thumbnail: z.object({ url: z.string() }),
    }),
  ),
  venues: z.array(
    atlasSchema.shape.venues.element.pick({
      id: true,
      name: true,
      city: true,
      country: true,
      coordinates: true,
    }),
  ),
  holdings: z.array(
    atlasSchema.shape.holdings.element.pick({ artworkId: true, venueId: true }),
  ),
});
export const catalogIndexSchema = browseAtlasSchema.extend({
  detailBase: z.string().regex(/^artwork-details\/[a-f0-9]{20}\/$/),
});
export const artworkContentSchema = z.object({
  work: atlasSchema.shape.artworks.element,
  images: z.array(imageSchema),
});
export type BrowseAtlas = z.infer<typeof browseAtlasSchema>;
export type CatalogIndex = z.infer<typeof catalogIndexSchema> & {
  /** Runtime-only base of the pinned content release, never read from JSON. */
  contentBase?: string;
};
export type ArtworkSummary = BrowseAtlas["artworks"][number];
export type ImageSummary = BrowseAtlas["images"][number];
export type VenueSummary = BrowseAtlas["venues"][number];
export type ArtworkContent = z.infer<typeof artworkContentSchema>;
export type ArtworkContext = Pick<
  BrowseAtlas,
  "artists" | "venues" | "holdings"
> & {
  images: ImageAsset[];
};
export type Category = "china" | "foreign" | "topics" | "favorites";
export type Scope =
  | `artist:${string}`
  | `topic:${string}`
  | "category:china"
  | "category:foreign"
  | "favorites";

export function scopeWorks<T extends ArtworkSummary>(
  data: Omit<BrowseAtlas, "artworks"> & { artworks: T[] },
  scope: string,
  favorites: ReadonlySet<string> = new Set(),
): T[] {
  if (scope === "favorites") {
    const byId = new Map(data.artworks.map((work) => [work.id, work]));
    // Keep saved records without images reachable, and retain unknown saved IDs
    // in storage so a later catalog update can restore them.
    return [...favorites]
      .reverse()
      .flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }
  // Keep researched records in the catalog, but only browse works with a
  // whole image or a usable reference image. New media makes them visible again.
  const visibleIds = new Set(
    data.images
      .filter((image) => image.role === "whole" || image.role === "reference")
      .map((image) => image.artworkId),
  );
  const visible = data.artworks.filter((work) => visibleIds.has(work.id));
  const [kind, id] = scope.split(":");
  if (kind === "topic") {
    const byId = new Map(visible.map((work) => [work.id, work]));
    return [
      ...new Set(
        data.topics.find((topic) => topic.id === id)?.artworkIds ?? [],
      ),
    ].flatMap((key) => (byId.get(key) ? [byId.get(key)!] : []));
  }
  const ids = new Set(
    data.artists
      .filter((artist) =>
        kind === "artist" ? artist.id === id : artist.category === id,
      )
      .map((artist) => artist.id),
  );
  return visible.filter((work) => work.artistIds.some((id) => ids.has(id)));
}
export function scopeLabel(data: BrowseAtlas, scope: string) {
  if (scope === "favorites") return "我的收藏";
  const [kind, id] = scope.split(":");
  return kind === "artist"
    ? (data.artists.find((a) => a.id === id)?.name ?? "画家")
    : kind === "topic"
      ? (data.topics.find((t) => t.id === id)?.title ?? "专题")
      : id === "foreign"
        ? "外国名画"
        : "中国名画";
}
export function venueWorks<T extends ArtworkSummary>(
  data: Pick<BrowseAtlas, "holdings">,
  works: T[],
  venueIds: string[],
) {
  const ids = new Set(
    data.holdings
      .filter((holding) => venueIds.includes(holding.venueId))
      .map((holding) => holding.artworkId),
  );
  return works.filter((work) => ids.has(work.id));
}
export function workVenues<T extends VenueSummary>(
  data: Pick<BrowseAtlas, "holdings"> & { venues: T[] },
  workId: string,
) {
  const ids = new Set(
    data.holdings.filter((h) => h.artworkId === workId).map((h) => h.venueId),
  );
  return data.venues.filter((v) => ids.has(v.id));
}
export function scopeVenues<T extends VenueSummary>(
  data: Pick<BrowseAtlas, "holdings"> & { venues: T[] },
  works: ArtworkSummary[],
) {
  const workIds = new Set(works.map((w) => w.id));
  const ids = new Set(
    data.holdings.filter((h) => workIds.has(h.artworkId)).map((h) => h.venueId),
  );
  return data.venues.filter((v) => ids.has(v.id) && v.coordinates);
}
export const primaryImage = <T extends ImageSummary>(
  data: { images: T[] },
  id: string,
) =>
  data.images.find(
    (image) =>
      image.artworkId === id &&
      (image.role === "whole" || image.role === "reference"),
  );
export function artistWorkCounts(data: BrowseAtlas): Map<string, number> {
  const visible = new Set(
    data.images
      .filter((image) => image.role === "whole" || image.role === "reference")
      .map((image) => image.artworkId),
  );
  const counts = new Map(data.artists.map((artist) => [artist.id, 0]));
  for (const work of data.artworks) {
    if (!visible.has(work.id)) continue;
    for (const artistId of new Set(work.artistIds))
      counts.set(artistId, (counts.get(artistId) ?? 0) + 1);
  }
  return counts;
}
export const artistLabel = (
  data: Pick<Atlas, "artists">,
  work: Pick<Artwork, "artistIds">,
) =>
  work.artistIds
    .map(
      (id) =>
        data.artists.find((artist) => artist.id === id)?.name ?? "作者待核实",
    )
    .join("、");
export function assetUrl(url: string) {
  // JSON media paths are relative to public/, never to the catalog URL or route.
  // Keep external URLs (including data/blob and protocol-relative URLs) intact.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return url;
  const base =
    import.meta.env.VITE_ASSET_BASE_URL?.trim() || import.meta.env.BASE_URL;
  return `${base.replace(/\/+$/, "")}/${url.replace(/^(?:\.\/|\/)+/, "")}`;
}
export function validateBrowseRelations(data: BrowseAtlas): string[] {
  const errors: string[] = [];
  for (const key of [
    "artists",
    "artworks",
    "venues",
    "topics",
    "images",
    "periods",
  ] as const) {
    const ids = data[key].map((item) => item.id);
    if (new Set(ids).size !== ids.length) errors.push(`${key} 的 ID 重复`);
  }
  const workIds = new Set(data.artworks.map((w) => w.id));
  const venues = new Set(data.venues.map((v) => v.id));
  const artistIds = new Set(data.artists.map((a) => a.id));
  const periodIds = new Set(data.periods.map((p) => p.id));
  const imagesByWork = new Map<string, ImageSummary[]>();
  for (const image of data.images) {
    const images = imagesByWork.get(image.artworkId) ?? [];
    images.push(image);
    imagesByWork.set(image.artworkId, images);
  }
  for (const artist of data.artists)
    if (!periodIds.has(artist.periodId))
      errors.push(`画家 ${artist.id} 的时期不存在`);
  for (const work of data.artworks) {
    if (
      !work.artistIds.length ||
      work.artistIds.some((id) => !artistIds.has(id))
    )
      errors.push(`作品 ${work.id} 的画家不存在`);
    const images = imagesByWork.get(work.id) ?? [];
    if (work.imageStatus === "unavailable") {
      if (images.length) errors.push(`作品 ${work.id} 标记无图但存在图像`);
    } else if (
      images.filter(
        (image) => image.role === "whole" || image.role === "reference",
      ).length !== 1
    ) {
      errors.push(`作品 ${work.id} 必须有且仅有一张全图或参考主图`);
    }
  }
  for (const venue of data.venues)
    if (
      venue.coordinates &&
      (Math.abs(venue.coordinates[0]) > 180 ||
        Math.abs(venue.coordinates[1]) > 90)
    )
      errors.push(`收藏地 ${venue.id} 坐标无效`);
  for (const holding of data.holdings)
    if (!workIds.has(holding.artworkId) || !venues.has(holding.venueId))
      errors.push("收藏关系引用不存在");
  for (const image of data.images) {
    if (!workIds.has(image.artworkId))
      errors.push(`图像 ${image.id} 无对应作品`);
  }
  for (const topic of data.topics)
    if (
      !topic.artworkIds.length ||
      new Set(topic.artworkIds).size !== topic.artworkIds.length ||
      topic.artworkIds.some((id) => !workIds.has(id))
    )
      errors.push(`专题 ${topic.id} 无效`);
  return errors;
}

export function validateRelations(data: Atlas): string[] {
  const errors = validateBrowseRelations(data);
  for (const image of data.images) {
    if (
      image.width <= 0 ||
      image.height <= 0 ||
      image.delivery.width !== image.width ||
      image.delivery.height !== image.height
    )
      errors.push(`${image.id} 图像尺寸无效`);
    if (image.delivery.kind === "image" && image.delivery.bytes > 20_000_000)
      errors.push(`${image.id} 超过高清文件限制`);
  }
  return errors;
}
