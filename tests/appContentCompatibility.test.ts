import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import full from "../public/catalog.json";
// @ts-expect-error Node publication helpers are JavaScript.
import { checkAppContent } from "../scripts/check-app-content.mjs";
// @ts-expect-error Node publication helpers are JavaScript.
import * as contentDelivery from "../scripts/build-content-delivery.mjs";
const { contentRevision, createCatalogIndex } = contentDelivery;

const work = full.artworks[0];
const local = {
  ...full,
  artworks: [work],
  images: full.images.filter((image) => image.artworkId === work.id),
  topics: [],
  holdings: [],
  venues: [],
};
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const digest = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");
function fixture(remote = structuredClone(local)) {
  const revision = contentRevision(remote);
  const index = createCatalogIndex(remote);
  const pointer = {
    schemaVersion: 1,
    revision,
    index: `releases/${revision}/catalog-index.json`,
    catalog: `releases/${revision}/catalog.json`,
    indexSha256: digest(bytes(index)),
    artworkCount: remote.artworks.length,
    imageCount: remote.images.length,
  };
  const localIndex = bytes(createCatalogIndex(local));
  const files = new Map([
    [`releases/${contentRevision(local)}/catalog-index.json`, localIndex],
    [pointer.index, bytes(index)],
    [pointer.catalog, bytes(remote)],
    ["current.json", bytes(pointer)],
    [
      `releases/${revision}/${index.detailBase}${work.id}.json`,
      bytes({
        work: remote.artworks[0],
        images: remote.images.filter((image) => image.artworkId === work.id),
      }),
    ],
  ]);
  const check = () =>
    checkAppContent({
      base: new URL("https://example.com/"),
      localCatalog: local,
      localIndex,
      get: async (url: URL) => {
        const result = files.get(url.pathname.slice(1));
        if (!result) throw new Error("Missing published file");
        return result;
      },
    });
  return { files, pointer, index, check };
}

describe("app deployment with independently published content", () => {
  it("accepts the same release and a newer compatible live release", async () => {
    await expect(fixture().check()).resolves.toMatchObject({
      currentRevision: contentRevision(local),
    });
    const remote = structuredClone(local);
    remote.artworks[0].title += " · updated";
    remote.artworks.push({ ...work, id: "new-work" });
    remote.images.push(
      ...local.images.map((image) => ({
        ...image,
        id: `new-${image.id}`,
        artworkId: "new-work",
      })),
    );
    await expect(fixture(remote).check()).resolves.toMatchObject({
      localRevision: contentRevision(local),
      currentRevision: contentRevision(remote),
      artworkCount: 2,
    });
  });

  it("still rejects local content that was never uploaded", async () => {
    const remote = structuredClone(local);
    remote.artworks[0].title += " · updated";
    const { files, check } = fixture(remote);
    files.delete(`releases/${contentRevision(local)}/catalog-index.json`);
    await expect(check()).rejects.toThrow("Missing published file");
  });

  it("rejects unsupported live schemas", async () => {
    const { files, pointer, check } = fixture();
    files.set("current.json", bytes({ ...pointer, schemaVersion: 2 }));
    await expect(check()).rejects.toThrow();
  });

  it("rejects corrupt indexes and catalogs", async () => {
    const remote = structuredClone(local);
    remote.artworks[0].title += " · updated";
    const a = fixture(remote);
    a.files.set(a.pointer.index, bytes({}));
    await expect(a.check()).rejects.toThrow();
    const b = fixture();
    const changed = structuredClone(local);
    changed.artworks[0].title += " · corrupted";
    b.files.set(b.pointer.catalog, bytes(changed));
    await expect(b.check()).rejects.toThrow(
      "Published catalog revision mismatch",
    );
  });

  it("rejects content formats the current viewer cannot read", async () => {
    const remote = structuredClone(local);
    remote.images[0].delivery.kind = "unsupported-format";
    await expect(fixture(remote).check()).rejects.toThrow();
  });

  it("rejects a validly hashed release with broken artwork references", async () => {
    const remote = structuredClone(local);
    remote.images[0].artworkId = "missing-work";
    await expect(fixture(remote).check()).rejects.toThrow(
      "Published content has invalid references",
    );
  });

  it("rejects an index inconsistent with its catalog even when the checksum matches", async () => {
    const remote = structuredClone(local);
    remote.artworks[0].title += " · updated";
    const { files, pointer, index, check } = fixture(remote);
    index.artworks[0].title = "Different title in summary";
    files.set(pointer.index, bytes(index));
    files.set(
      "current.json",
      bytes({ ...pointer, indexSha256: digest(bytes(index)) }),
    );
    await expect(check()).rejects.toThrow("Published index and catalog differ");
  });

  it("rejects detail payloads that disagree with their pinned catalog", async () => {
    const { files, pointer, index, check } = fixture();
    files.set(
      `releases/${pointer.revision}/${index.detailBase}${work.id}.json`,
      bytes({ work: { ...work, title: "Wrong detail" }, images: local.images }),
    );
    await expect(check()).rejects.toThrow();
  });
});
