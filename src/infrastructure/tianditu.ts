import type {
  RasterSourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

const attribution =
  '<a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer">天地图</a> © <a href="https://www.ngcc.cn/" target="_blank" rel="noopener noreferrer">国家基础地理信息中心</a>';

/** Official WMTS imagery: preserve its boundaries, labels and original colours. */
export function createTiandituStyle(
  rawKey: string | undefined,
): StyleSpecification {
  const key = rawKey?.trim();
  if (!key) throw new Error("尚未配置天地图 Key，可先从目录浏览作品。");
  if (!/^[a-f\d]{32}$/i.test(key)) {
    throw new Error("天地图 Key 配置格式有误，可先从目录浏览作品。");
  }
  const source = (layer: "vec" | "cva" | "ibo"): RasterSourceSpecification => ({
    type: "raster",
    tiles: Array.from(
      { length: 4 },
      (_, index) =>
        `https://t${index}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${encodeURIComponent(key)}`,
    ),
    tileSize: 256,
    minzoom: 1,
    maxzoom: 18,
    attribution,
  });
  return {
    version: 8,
    name: "天地图 · 官方底图",
    sources: {
      "tianditu-base": source("vec"),
      "tianditu-boundaries": source("ibo"),
      "tianditu-labels": source("cva"),
    },
    layers: [
      { id: "tianditu-base", type: "raster", source: "tianditu-base" },
      {
        id: "tianditu-boundaries",
        type: "raster",
        source: "tianditu-boundaries",
      },
      { id: "tianditu-labels", type: "raster", source: "tianditu-labels" },
    ],
  };
}
