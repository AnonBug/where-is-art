import { collectionMuseums, collectionWorks } from "../lib/catalog";
import type { AtlasData } from "../types";
import { Header } from "./Header";

export function CollectionDirectory({
  data,
  onNavigate,
}: {
  data: AtlasData;
  onNavigate: (id: string | null) => void;
}) {
  return (
    <>
      <Header
        registry={data.registry}
        collectionId={null}
        onNavigate={onNavigate}
      />
      <main className="directory">
        <div className="directory-intro">
          <span className="eyebrow">名画的收藏地，一部持续生长的目录</span>
          <h1>
            一幅画，
            <br />
            如今在哪里？
          </h1>
          <p>{data.registry.description}</p>
          <p className="directory-note">
            从一个专题开始，沿着收藏机构，走近作品本身。
          </p>
        </div>
        <section aria-labelledby="directory-title">
          <div className="directory-section-heading">
            <h2 id="directory-title">专题目录</h2>
            <span>
              {data.registry.collections.length} 个专题 · {data.works.length}{" "}
              件作品
            </span>
          </div>
          <div className="collection-grid">
            {data.registry.collections.map((collection) => {
              const works = collectionWorks(collection, data.works);
              const museums = collectionMuseums(works, data.museums);
              return (
                <a
                  className="collection-card"
                  key={collection.id}
                  href={`?collection=${encodeURIComponent(collection.id)}`}
                  onClick={(event) => {
                    if (
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.shiftKey &&
                      !event.altKey
                    ) {
                      event.preventDefault();
                      onNavigate(collection.id);
                    }
                  }}
                >
                  <img
                    src={data.images[collection.coverWorkId].path}
                    alt={
                      data.works.find(
                        (work) => work.id === collection.coverWorkId,
                      )?.title ?? collection.title
                    }
                  />
                  <div>
                    <span className="eyebrow">艺术专题</span>
                    <h3>{collection.title}</h3>
                    <p>{collection.description}</p>
                    <span className="collection-stats">
                      {works.length} 件作品 · {Object.keys(museums).length}{" "}
                      个收藏机构 ·{" "}
                      {
                        new Set(
                          Object.values(museums).map(
                            (museum) => museum.country,
                          ),
                        ).size
                      }{" "}
                      个国家
                    </span>
                    <span className="collection-enter">进入专题地图 ↗</span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
        <p className="directory-footnote">
          地图展示收藏归属，非实时展出位置。作品归属、图像许可及资料来源见各专题详情。
        </p>
      </main>
    </>
  );
}
