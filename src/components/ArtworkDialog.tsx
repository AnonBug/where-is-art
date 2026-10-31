import { useEffect, useState } from "react";
import type { Artist, ArtworkImage, Museum, Work } from "../types";
import { Modal } from "./Modal";

interface Props {
  work: Work;
  image: ArtworkImage;
  museum?: Museum;
  artists: Record<string, Artist>;
  sequence: Work[];
  favorite: boolean;
  storageError: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onLocate: (work: Work) => void;
  onFavorite: (id: string) => void;
}

export function ArtworkDialog({
  work,
  image,
  museum,
  artists,
  sequence,
  favorite,
  storageError,
  onClose,
  onOpen,
  onLocate,
  onFavorite,
}: Props) {
  const [zoomed, setZoomed] = useState(false);
  const index = sequence.findIndex((item) => item.id === work.id);
  const previous = sequence[index - 1];
  const next = sequence[index + 1];
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches("input, textarea, select") ||
          event.target.isContentEditable)
      )
        return;
      if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        onOpen(next.id);
      }
      if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        onOpen(previous.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previous, next, onOpen]);

  return (
    <Modal
      id="detail"
      labelledBy="detailTitle"
      closeLabel="关闭作品详情"
      className={zoomed ? "image-full" : ""}
      onClose={onClose}
    >
      <div id="detailContent">
        <div className="detail-image">
          <button
            aria-label="放大或缩小画作"
            aria-pressed={zoomed}
            onClick={() => setZoomed((value) => !value)}
          >
            <img src={image.path} alt={`${work.title}完整图像`} />
          </button>
          <a
            className="image-credit"
            href={image.source}
            target="_blank"
            rel="noopener"
          >
            {image.credit ?? "图像来源与许可 ↗"}
            <br />
            点击画作放大查看
          </a>
          {image.licenseUrl && (
            <a
              className="image-credit"
              href={image.licenseUrl}
              target="_blank"
              rel="noopener"
            >
              {image.licenseLabel}
            </a>
          )}
        </div>
        <div className="detail-copy">
          <span
            className={`badge${work.kind === "归属争议" ? " disputed" : ""}`}
          >
            {work.kind}
          </span>
          <h2 id="detailTitle">{work.title}</h2>
          <div className="english">{work.en}</div>
          <dl>
            <dt>相关艺术家</dt>
            <dd>
              {work.artistIds.map((id) => artists[id]?.name ?? id).join("、")}
            </dd>
            <dt>年代</dt>
            <dd>{work.date}</dd>
            <dt>媒介</dt>
            <dd>{work.medium}</dd>
            <dt>收藏</dt>
            <dd>{museum?.name ?? "私人收藏 · 存放地点未确认"}</dd>
            <dt>地点</dt>
            <dd>
              {museum ? `${museum.country} · ${museum.city}` : "不设置地图坐标"}
            </dd>
            {museum?.address && (
              <>
                <dt>地址</dt>
                <dd>{museum.address}</dd>
              </>
            )}
          </dl>
          <h3>{work.subtitle}</h3>
          <p>{work.description}</p>
          <div className="look">
            <b>可以这样看</b>
            {work.look}
          </div>
          {work.note && <p className="note">说明：{work.note}</p>}
          <div className="detail-actions">
            {museum && (
              <button className="primary" onClick={() => onLocate(work)}>
                在地图中定位 ↗
              </button>
            )}
            <button onClick={() => onFavorite(work.id)} aria-pressed={favorite}>
              {favorite ? "♥ 已收藏" : "♡ 收藏这件作品"}
            </button>
            <a href={work.source} target="_blank" rel="noopener">
              {work.kind === "归属争议" ? "查阅归属资料" : "馆藏资料"} ↗
            </a>
          </div>
          {storageError && (
            <p className="note" role="status">
              浏览器未允许保存，收藏仅在本次打开期间保留。
            </p>
          )}
        </div>
      </div>
      <div className="detail-nav">
        <button
          disabled={!previous}
          onClick={() => previous && onOpen(previous.id)}
        >
          ← 上一件
        </button>
        <span>
          {index + 1} / {sequence.length}
        </span>
        <button disabled={!next} onClick={() => next && onOpen(next.id)}>
          下一件 →
        </button>
      </div>
    </Modal>
  );
}
