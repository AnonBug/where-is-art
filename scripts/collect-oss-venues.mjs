import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { parseCsv } from "./lib/oss-csv.mjs";

const rows = parseCsv(await fs.readFile(process.argv[2], "utf8"));
const directory = "output/oss-catalog-import/entities";
await fs.mkdir(directory, { recursive: true });
const entities = {};
for (const [folder, pattern] of [
  ["output/monet-expansion", /^monet-entities.*\.json$/],
  ["output/van-gogh-expansion", /^entities.*\.json$/],
  ["output/masters-expansion", /^location-entities\.json$/],
  [directory, /\.json$/],
]) {
  for (const name of await fs.readdir(folder).catch(() => [])) {
    if (!pattern.test(name)) continue;
    const json = JSON.parse(await fs.readFile(`${folder}/${name}`, "utf8"));
    Object.assign(entities, json.entities ?? json);
  }
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function load(ids, phase) {
  const missing = [...new Set(ids)].filter(
    (id) => /^Q\d+$/.test(id) && !entities[id],
  );
  console.log(`${phase}: ${missing.length} entities to retrieve`);
  const batches = [];
  for (let i = 0; i < missing.length; i += 40)
    batches.push(missing.slice(i, i + 40));
  let next = 0;
  await Promise.all(
    Array.from({ length: 1 }, async () => {
      while (next < batches.length) {
        const ids = batches[next++];
        let result, failure;
        for (let attempt = 0; attempt < 6; attempt++) {
          try {
            const url = new URL("https://www.wikidata.org/w/api.php");
            url.search = new URLSearchParams({
              action: "wbgetentities",
              ids: ids.join("|"),
              props: "labels|aliases|descriptions|claims|info",
              languages: "zh-hans|zh|zh-hant|en|fr|de|it|nl",
              format: "json",
            });
            const response = await fetch(url, {
              signal: AbortSignal.timeout(60000),
              headers: {
                "User-Agent":
                  "WhereIsArtCatalogImport/1.0 (catalog collection reconciliation)",
              },
            });
            if (response.status === 429) {
              await delay(
                Math.max(
                  2000,
                  Number(response.headers.get("retry-after") ?? 2) * 1000,
                ) *
                  (attempt + 1),
              );
              throw new Error("Wikidata HTTP 429; retry after backoff");
            }
            assert.ok(response.ok, `Wikidata HTTP ${response.status}`);
            result = await response.json();
            assert.ok(result.entities, JSON.stringify(result.error));
            failure = undefined;
            break;
          } catch (error) {
            failure = error;
          }
        }
        if (failure) throw failure;
        Object.assign(entities, result.entities);
        await fs.writeFile(
          `${directory}/${phase}-${ids[0]}.json`,
          JSON.stringify(result),
        );
        await delay(2100);
      }
    }),
  );
}
function values(entity, property) {
  return (entity?.claims?.[property] ?? [])
    .filter(
      (claim) =>
        claim.rank !== "deprecated" &&
        !claim.qualifiers?.P582 &&
        !claim.qualifiers?.P585,
    )
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter(Boolean);
}
await load(
  rows.map((row) => row["Wikidata QID"]),
  "works",
);
const collections = [
  ...new Set(
    rows.flatMap((row) =>
      values(entities[row["Wikidata QID"]], "P195").map((value) => value.id),
    ),
  ),
];
await load(collections, "collections");
await load(
  collections.flatMap((id) =>
    ["P17", "P131"].flatMap((property) =>
      values(entities[id], property).map((value) => value.id),
    ),
  ),
  "places",
);
const label = (id) =>
  ["zh-hans", "zh", "en"]
    .map((language) => entities[id]?.labels?.[language]?.value)
    .find(Boolean) ?? "";
const evidence = {
  checkedAt: new Date().toISOString().slice(0, 10),
  note: "收藏实体和别名用于匹配用户 CSV；仅在收藏名称相符时使用机构坐标，不由作品的历史收藏声明推定实时所在地。",
  works: Object.fromEntries(
    rows
      .filter((row) => row["Wikidata QID"])
      .map((row) => [
        row["作品ID"],
        {
          qid: row["Wikidata QID"],
          revision: entities[row["Wikidata QID"]]?.lastrevid ?? null,
          collections: values(entities[row["Wikidata QID"]], "P195").map(
            (value) => value.id,
          ),
        },
      ]),
  ),
  collections: Object.fromEntries(
    collections
      .filter((id) => entities[id])
      .map((id) => {
        const entity = entities[id];
        const geo = values(entity, "P625").find(
          (value) => value.globe === "http://www.wikidata.org/entity/Q2",
        );
        return [
          id,
          {
            id,
            name: label(id),
            revision: entity.lastrevid ?? null,
            labels: [
              ...new Set([
                ...Object.values(entity.labels ?? {}).map((item) => item.value),
                ...Object.values(entity.aliases ?? {})
                  .flat()
                  .map((item) => item.value),
              ]),
            ],
            description: entity.descriptions?.en?.value ?? "",
            types: values(entity, "P31").map((value) => value.id),
            coordinates: geo ? [geo.longitude, geo.latitude] : null,
            city:
              values(entity, "P131")
                .map((value) => label(value.id))
                .find(Boolean) ?? "地点待核实",
            country:
              values(entity, "P17")
                .map((value) => label(value.id))
                .find(Boolean) ?? "国家待核实",
            website: values(entity, "P856")[0] ?? "",
          },
        ];
      }),
  ),
};
await fs.writeFile(
  "output/oss-catalog-import/venue-evidence.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  `Collection evidence ready: ${collections.length} collection entities.`,
);
