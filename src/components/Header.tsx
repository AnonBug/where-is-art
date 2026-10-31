import type { CollectionRegistry } from "../types";

export function Header({
  registry,
  collectionId,
  onNavigate,
  onAbout,
}: {
  registry: CollectionRegistry;
  collectionId: string | null;
  onNavigate: (id: string | null) => void;
  onAbout?: () => void;
}) {
  return (
    <header className="header">
      <a
        href="./"
        className="brand"
        onClick={(event) => {
          if (
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            event.preventDefault();
            onNavigate(null);
          }
        }}
      >
        <span className="seal">绘</span>
        <span>
          {registry.title}
          <small>循着名画，找到收藏它的地方</small>
        </span>
      </a>
      <nav>
        {collectionId && (
          <>
            <select
              aria-label="切换专题"
              value={collectionId}
              onChange={(event) => onNavigate(event.target.value || null)}
            >
              <option value="">专题目录</option>
              {registry.collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
            <button onClick={onAbout}>关于这张地图 ↗</button>
          </>
        )}
        <a href="data.json" download="名画在哪里_作品资料.json">
          下载图录 ↓
        </a>
      </nav>
    </header>
  );
}
