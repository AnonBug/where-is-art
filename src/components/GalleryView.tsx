import { useMemo } from "react";
import { sortWorks } from "../lib/catalog";
import type { SortOrder } from "../types";
import { ArtworkList } from "./ArtworkList";
import type { ArtworkListProps } from "./ArtworkList";

interface Props extends ArtworkListProps {
  visible: boolean;
  sort: SortOrder;
  onSort: (sort: SortOrder) => void;
}

export function GalleryView({ visible, sort, onSort, ...list }: Props) {
  const works = useMemo(
    () => sortWorks(list.works, list.museums, sort),
    [list.works, list.museums, sort],
  );
  return (
    <section id="galleryView" hidden={!visible} aria-label="全部作品图录">
      <div className="gallery-heading">
        <div>
          <span className="eyebrow">一部可以打开的作品目录</span>
          <h2>传世名画图录</h2>
        </div>
        <label>
          排序{" "}
          <select
            value={sort}
            onChange={(event) => onSort(event.target.value as SortOrder)}
            aria-label="图录排序"
          >
            <option value="default">精选顺序</option>
            <option value="date">创作年代</option>
            <option value="museum">收藏地点</option>
          </select>
        </label>
      </div>
      <div className="gallery-cards" id="galleryCards">
        <ArtworkList {...list} works={works} />
      </div>
      {works.length === 0 && (
        <p id="empty">没有找到符合条件的作品。试试减少筛选条件。</p>
      )}
    </section>
  );
}
