import { lazy, Suspense, useEffect } from "react";
import { CollectionDirectory } from "./components/CollectionDirectory";
import { useAtlasData } from "./hooks/useAtlasData";
import { useCollectionNavigation } from "./hooks/useCollectionNavigation";
import { useFavorites } from "./hooks/useFavorites";

const AtlasExplorer = lazy(() => import("./AtlasExplorer"));

export function App() {
  const { data, error } = useAtlasData();
  const { favorites, toggleFavorite, storageError } = useFavorites();
  const { collectionId, legacyWorkId, navigate } = useCollectionNavigation();
  // Old #work=... links resolve to their first collection without breaking saved links.
  const collection = data?.registry.collections.find((item) =>
    collectionId
      ? item.id === collectionId
      : legacyWorkId && item.workIds.includes(legacyWorkId),
  );
  useEffect(() => {
    if (data)
      document.title = collection
        ? `${collection.title} · ${data.registry.title}`
        : `${data.registry.title} · 中外名画收藏目录`;
  }, [data, collection]);

  if (error)
    return (
      <main className="page-message" role="alert">
        <h1>页面资料暂时未能载入</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>重新加载</button>
        <a href="data.json">打开作品资料</a>
      </main>
    );
  if (!data)
    return (
      <main className="page-message" role="status">
        正在打开名画目录…
      </main>
    );
  if (collectionId && !collection)
    return (
      <main className="page-message">
        <h1>未找到这个专题</h1>
        <button onClick={() => navigate(null)}>返回专题目录</button>
      </main>
    );
  if (!collection)
    return <CollectionDirectory data={data} onNavigate={navigate} />;
  return (
    <Suspense
      fallback={
        <main className="page-message" role="status">
          正在展开收藏地图…
        </main>
      }
    >
      <AtlasExplorer
        key={collection.id}
        data={data}
        collection={collection}
        favorites={favorites}
        storageError={storageError}
        onFavorite={toggleFavorite}
        onNavigate={navigate}
      />
    </Suspense>
  );
}
