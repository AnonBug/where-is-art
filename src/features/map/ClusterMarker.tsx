import { primaryImage, type Atlas, type Artwork } from "../../domain/atlas";
import { ArtworkImage } from "../../shared/ui";
import s from "./ClusterMarker.module.scss";

interface Props {
  data: Atlas;
  works: Artwork[];
  selected?: string;
  onExpand: () => void;
  onWork: (id: string) => void;
}

export function ClusterMarker({
  data,
  works,
  selected,
  onExpand,
  onWork,
}: Props) {
  const preview =
    works.find((work) => work.id === selected && primaryImage(data, work.id)) ??
    works.find((work) => primaryImage(data, work.id));

  return (
    <div className={s.marker}>
      {preview && (
        <button
          type="button"
          className={`${s.preview} ${preview.id === selected ? s.active : ""}`}
          aria-label={`查看${preview.title}`}
          title={preview.title}
          onClick={() => onWork(preview.id)}
        >
          <ArtworkImage
            key={preview.id}
            src={primaryImage(data, preview.id)?.thumbnail.url}
            alt=""
          />
        </button>
      )}
      <button
        type="button"
        className={s.count}
        aria-label={`${works.length} 幅作品，放大查看收藏地`}
        onClick={onExpand}
      >
        <span
          style={{ fontSize: Math.min(17, 60 / String(works.length).length) }}
        >
          {works.length}
        </span>
      </button>
    </div>
  );
}
