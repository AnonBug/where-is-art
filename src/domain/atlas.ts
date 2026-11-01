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
      description: z.string(),
      sourceUrl: z.string(),
      note: z.string().default(""),
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
export type Category = "china" | "foreign" | "topics";
export type Scope =
  | `artist:${string}`
  | `topic:${string}`
  | "category:china"
  | "category:foreign";

export function scopeWorks(data: Atlas, scope: string): Artwork[] {
  const [kind, id] = scope.split(":");
  if (kind === "topic") {
    const byId = new Map(data.artworks.map((work) => [work.id, work]));
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
  return data.artworks.filter((work) =>
    work.artistIds.some((id) => ids.has(id)),
  );
}
export function scopeLabel(data: Atlas, scope: string) {
  const [kind, id] = scope.split(":");
  return kind === "artist"
    ? (data.artists.find((a) => a.id === id)?.name ?? "画家")
    : kind === "topic"
      ? (data.topics.find((t) => t.id === id)?.title ?? "专题")
      : id === "foreign"
        ? "外国名画"
        : "中国名画";
}
export function venueWorks(data: Atlas, works: Artwork[], venueIds: string[]) {
  const ids = new Set(
    data.holdings
      .filter((holding) => venueIds.includes(holding.venueId))
      .map((holding) => holding.artworkId),
  );
  return works.filter((work) => ids.has(work.id));
}
export function workVenues(data: Atlas, workId: string) {
  const ids = new Set(
    data.holdings.filter((h) => h.artworkId === workId).map((h) => h.venueId),
  );
  return data.venues.filter((v) => ids.has(v.id));
}
export function scopeVenues(data: Atlas, works: Artwork[]) {
  const workIds = new Set(works.map((w) => w.id));
  const ids = new Set(
    data.holdings.filter((h) => workIds.has(h.artworkId)).map((h) => h.venueId),
  );
  return data.venues.filter((v) => ids.has(v.id) && v.coordinates);
}
export const primaryImage = (data: Atlas, id: string) =>
  data.images.find(
    (image) =>
      image.artworkId === id &&
      (image.role === "whole" || image.role === "reference"),
  );
export const artistLabel = (data: Atlas, work: Artwork) =>
  work.artistIds
    .map(
      (id) =>
        data.artists.find((artist) => artist.id === id)?.name ?? "作者待核实",
    )
    .join("、");
export function assetUrl(url: string) {
  return /^https:\/\//.test(url)
    ? url
    : `${import.meta.env.BASE_URL}${url.replace(/^\//, "")}`;
}
export function validateRelations(data: Atlas): string[] {
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
  for (const artist of data.artists)
    if (!periodIds.has(artist.periodId))
      errors.push(`画家 ${artist.id} 的时期不存在`);
  for (const work of data.artworks) {
    if (
      !work.artistIds.length ||
      work.artistIds.some((id) => !artistIds.has(id))
    )
      errors.push(`作品 ${work.id} 的画家不存在`);
    const images = data.images.filter((image) => image.artworkId === work.id);
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
  for (const topic of data.topics)
    if (
      !topic.artworkIds.length ||
      new Set(topic.artworkIds).size !== topic.artworkIds.length ||
      topic.artworkIds.some((id) => !workIds.has(id))
    )
      errors.push(`专题 ${topic.id} 无效`);
  return errors;
}
