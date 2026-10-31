import type { ArtworkImage, Museum, Work } from "../types";

interface Props {
  work: Work;
  museum?: Museum;
  image: ArtworkImage;
  favorite: boolean;
  onOpen: (id: string) => void;
}

export function ArtworkCard({ work, museum, image, favorite, onOpen }: Props) {
  return (
    <button
      className="art-card"
      onClick={() => onOpen(work.id)}
      aria-label={`查看${work.title}`}
    >
      <img src={image.path} alt={work.title} loading="lazy" />
      <div className="card-copy">
        <h3>{work.title}</h3>
        <p>
          {work.date}
          <br />
          {museum
            ? `${museum.city} · ${museum.name.split(" · ")[0]}`
            : "位置未确认"}
        </p>
        <span className="kind">
          {work.kind}
          {favorite && " · 已收藏"}
        </span>
      </div>
    </button>
  );
}
