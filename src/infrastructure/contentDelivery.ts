import { z } from "zod";
import { version } from "../../package.json";
import {
  catalogIndexSchema,
  validateBrowseRelations,
  type CatalogIndex,
} from "../domain/atlas";

export const contentPointerSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.string().regex(/^[a-f0-9]{20}$/),
  index: z.string(),
});

async function readJson(url: string, revalidate = false) {
  const response = await fetch(url, {
    ...(revalidate ? { cache: "no-cache" as const } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("内容暂时无法加载");
  return response.json();
}

export async function loadCatalog(): Promise<CatalogIndex> {
  const configured = import.meta.env.VITE_CONTENT_BASE_URL?.trim();
  let contentBase = import.meta.env.BASE_URL;
  let indexUrl = `${contentBase}catalog-index.json?v=${version}`;
  let revision: string | undefined;
  if (configured) {
    const root = new URL(`${configured.replace(/\/+$/, "")}/`);
    if (root.protocol !== "https:" || root.search || root.hash)
      throw new Error("内容地址配置不正确");
    const pointer = contentPointerSchema.parse(
      await readJson(new URL("current.json", root).href, true),
    );
    revision = pointer.revision;
    // Restrict the pointer to this origin and its immutable release directory.
    if (pointer.index !== `releases/${revision}/catalog-index.json`)
      throw new Error("内容版本路径不正确");
    indexUrl = new URL(pointer.index, root).href;
    contentBase = new URL("./", indexUrl).href;
  }
  const data = catalogIndexSchema.parse(await readJson(indexUrl, !configured));
  if (
    validateBrowseRelations(data).length ||
    (revision && data.detailBase !== `artwork-details/${revision}/`)
  )
    throw new Error("内容数据校验未通过");
  return { ...data, contentBase };
}

export function artworkContentUrl(index: CatalogIndex, id: string) {
  return `${index.contentBase ?? import.meta.env.BASE_URL}${index.detailBase}${encodeURIComponent(id)}.json`;
}
