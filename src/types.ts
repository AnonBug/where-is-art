import type { FeatureCollection, Geometry } from "geojson";

export interface Work {
  id: string;
  artistIds: string[];
  title: string;
  en: string;
  museum: string | null;
  kind: string;
  theme: string;
  date: string;
  startYear?: number;
  medium: string;
  subtitle: string;
  description: string;
  look: string;
  note: string;
  source: string;
}

export interface Museum {
  name: string;
  city: string;
  address?: string;
  country: string;
  mapCountry?: string;
  lat: number;
  lng: number;
  source: string;
}

export type Museums = Record<string, Museum>;
export interface Artist {
  id: string;
  name: string;
  en: string;
}
export interface Catalog {
  works: Work[];
  museums: Museums;
  artists: Record<string, Artist>;
}
export interface Collection {
  id: string;
  title: string;
  description: string;
  coverWorkId: string;
  workIds: string[];
  eyebrow: string;
  introTitle: string[];
  introDescription: string;
  mapHint: string;
  featuredWorkId: string;
  defaultRegion: Region;
  updatedAt: string;
  scope: string;
  attributionNotes: { label: string; description: string }[];
}
export interface CollectionRegistry {
  schemaVersion: number;
  title: string;
  description: string;
  collections: Collection[];
}
export interface ArtworkImage {
  path: string;
  source: string;
  url: string;
  bytes: number;
  credit?: string;
  licenseUrl?: string;
  licenseLabel?: string;
}
export type ArtworkImages = Record<string, ArtworkImage>;
export type WorldMap = FeatureCollection<Geometry, { name: string }>;
export interface AtlasData extends Catalog {
  images: ArtworkImages;
  world: WorldMap;
  registry: CollectionRegistry;
}

export interface Filters {
  query: string;
  kind: string;
  country: string;
  theme: string;
  artist: string;
  favoritesOnly: boolean;
}

export type View = "map" | "gallery";
export type Region = "europe" | "world" | "collection";
export type SortOrder = "default" | "date" | "museum";
export interface MapFocus {
  museumIds: string[];
  revision: number;
}
