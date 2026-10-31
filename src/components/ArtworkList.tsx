import type { ArtworkImages, Museums, Work } from "../types";
import { ArtworkCard } from "./ArtworkCard";

export interface ArtworkListProps {
  works: Work[];
  museums: Museums;
  images: ArtworkImages;
  favorites: ReadonlySet<string>;
  onOpen: (id: string) => void;
}

export function ArtworkList({
  works,
  museums,
  images,
  favorites,
  onOpen,
}: ArtworkListProps) {
  return works.map((work) => (
    <ArtworkCard
      key={work.id}
      work={work}
      museum={work.museum ? museums[work.museum] : undefined}
      image={images[work.id]}
      favorite={favorites.has(work.id)}
      onOpen={onOpen}
    />
  ));
}
