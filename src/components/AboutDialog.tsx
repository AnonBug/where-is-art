import { Fragment } from "react";
import type { Collection, Museums } from "../types";
import { Modal } from "./Modal";

export function AboutDialog({
  collection,
  museums,
  onClose,
}: {
  collection: Collection;
  museums: Museums;
  onClose: () => void;
}) {
  return (
    <Modal
      id="about"
      labelledBy="aboutTitle"
      closeLabel="关闭说明"
      onClose={onClose}
    >
      <div className="about-body">
        <span className="eyebrow">读图之前 · {collection.title}</span>
        <h2 id="aboutTitle">这张地图如何阅读</h2>
        <p>{collection.scope}</p>
        <dl>
          {collection.attributionNotes.map((note) => (
            <Fragment key={note.label}>
              <dt>{note.label}</dt>
              <dd>{note.description}</dd>
            </Fragment>
          ))}
        </dl>
        <p>
          地图按收藏机构的近似位置标记，不能证明原件当前正在馆内展出。前往参观请查阅各馆最新公告。创作年代多为估计，存在不同断代意见。
        </p>
        <h3>资料与图像</h3>
        <p>
          每件作品详情附馆藏或研究来源链接，图像页记录其来源与许可；绘画照片不替代馆方鉴定。地图底图来自
          Natural Earth 地理数据的 GeoJSON 版本，由 Leaflet
          绘制；不依赖在线瓦片。
        </p>
        <p>
          交互结构参考
          <a href="https://lab.xiebq.com/beike/" target="_blank" rel="noopener">
            中国名碑名刻数字博物馆
          </a>
          的筛选、地图与列表浏览方式。本站独立制作。
        </p>
        <div className="source-links">
          {Object.entries(museums).map(([id, museum]) => (
            <a key={id} href={museum.source} target="_blank" rel="noopener">
              {museum.name.split(" · ")[0]} ↗
            </a>
          ))}
        </div>
        <p className="muted">
          资料整理：{collection.updatedAt}
          。本地收藏仅保存在当前浏览器。清除浏览器数据会清除收藏。
        </p>
      </div>
    </Modal>
  );
}
