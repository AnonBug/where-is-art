import fs from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../content/artwork-guides/", import.meta.url);
const read = async (name) =>
  JSON.parse(await fs.readFile(new URL(name, root), "utf8"));

export async function enrichArtworkGuides(artworks) {
  const files = (await fs.readdir(root)).sort();
  const overrides = {};
  const corrections = {};
  for (const file of files.filter((file) => file.endsWith("-overrides.json"))) {
    for (const [id, guide] of Object.entries(await read(file))) {
      assert.ok(!overrides[id], `Duplicate guide: ${id}`);
      overrides[id] = guide;
    }
  }
  for (const file of files.filter(
    (file) => file.startsWith("catalog-corrections-") && file.endsWith(".json"),
  )) {
    for (const [id, correction] of Object.entries(await read(file))) {
      assert.ok(!corrections[id], `Duplicate catalog correction: ${id}`);
      corrections[id] = correction;
    }
  }
  const ids = new Set(artworks.map((w) => w.id));
  for (const id of [...Object.keys(overrides), ...Object.keys(corrections)])
    assert.ok(ids.has(id), `Unknown guide/correction: ${id}`);

  return artworks.map((original) => {
    const { guide: previousGuide, ...record } = original;
    const correction = corrections[original.id];
    const work = correction
      ? {
          ...record,
          ...(correction.title ? { title: correction.title } : {}),
          ...(correction.dateLabel ? { dateLabel: correction.dateLabel } : {}),
          ...(correction.medium ? { medium: correction.medium } : {}),
          sourceUrl: correction.sourceUrl,
          note: [original.note, correction.note].filter(Boolean).join(" "),
        }
      : record;
    // Keep known titles without turning catalogue boilerplate into an essay.
    if (/^(提香|伦勃朗)相关绘画。/.test(work.description))
      work.description = work.description.match(/原题：[^。]+。/)?.[0] ?? "";
    const guide = overrides[work.id] ?? previousGuide;
    // Contextual drafts remain in editorial sources for further research.
    // Only individually sourced interpretation belongs in published entries.
    return guide?.scope === "individual" ? { ...work, guide } : work;
  });
}
