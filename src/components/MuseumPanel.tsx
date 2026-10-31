import { Fragment } from "react";
import type { ArtworkImages, Museums, Work } from "../types";

interface Props {
  ids: string[];
  works: Work[];
  museums: Museums;
  images: ArtworkImages;
  onOpen: (id: string) => void;
  onClose: () => void;
  onZoom: (ids: string[]) => void;
}

export function MuseumPanel({
  ids,
  works,
  museums,
  images,
  onOpen,
  onClose,
  onZoom,
}: Props) {
  if (!ids.length) return null;
  const single = ids.length === 1 ? museums[ids[0]] : null;
  const selectedWorks = works.filter(
    (work) => work.museum && ids.includes(work.museum),
  );
  return (
    <div className="museum-panel">
      <button
        className="close-panel"
        onClick={onClose}
        aria-label="关闭收藏机构详情"
      >
        ×
      </button>
      <span className="eyebrow">
        {single
          ? `${single.country} · ${single.city}`
          : `${ids.length}个收藏机构 · ${selectedWorks.length}件作品`}
      </span>
      <h2>
        {single?.name ??
          [...new Set(ids.map((id) => museums[id].city))].join(" · ")}
      </h2>
      {single ? (
        <p className="museum-meta">
          当前筛选 {selectedWorks.length} 件 · 收藏归属，非展出承诺
        </p>
      ) : (
        <button className="zoom-group" onClick={() => onZoom(ids)}>
          放大这一区域 ↗
        </button>
      )}
      {ids.map((id) => (
        <Fragment key={id}>
          {!single && <h3 className="group-museum">{museums[id].name}</h3>}
          {selectedWorks
            .filter((work) => work.museum === id)
            .map((work) => (
              <button
                key={work.id}
                className="museum-work"
                onClick={() => onOpen(work.id)}
              >
                <img src={images[work.id].path} alt="" />
                <span>
                  <strong>{work.title}</strong>
                  <small>
                    {work.kind}
                    {single && ` · ${work.date}`}
                  </small>
                </span>
              </button>
            ))}
        </Fragment>
      ))}
      {single && (
        <a href={single.source} target="_blank" rel="noopener">
          查看馆方资料 ↗
        </a>
      )}
    </div>
  );
}
