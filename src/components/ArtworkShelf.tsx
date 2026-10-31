import { ArtworkList } from "./ArtworkList";
import type { ArtworkListProps } from "./ArtworkList";

export function ArtworkShelf({
  title,
  ...list
}: ArtworkListProps & { title: string }) {
  return (
    <section className="shelf">
      <div className="shelf-top">
        <div>
          <span className="eyebrow">让目光慢下来</span>
          <h2>{title}</h2>
        </div>
        <span className="shelf-hint">点击画作，读懂细节 →</span>
      </div>
      <div className="shelf-cards">
        {list.works.length ? (
          <ArtworkList {...list} />
        ) : (
          <p className="muted">没有符合条件的作品，试试重置筛选。</p>
        )}
      </div>
    </section>
  );
}
