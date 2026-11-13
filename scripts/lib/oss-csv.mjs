import assert from "node:assert/strict";

// RFC 4180 fields, including the BOM, escaped quotes and embedded newlines in
// the exported catalogue. Never split a row on commas inside a quoted field.
export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(field);
      field = "";
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else field += c;
  }
  assert.ok(!quoted, "Unclosed CSV field");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift();
  assert.ok(headers?.includes("作品ID"), "Missing artwork ID column");
  const seen = new Set();
  return rows.map((values, index) => {
    assert.equal(values.length, headers.length, `CSV row ${index + 2}`);
    const item = Object.fromEntries(
      headers.map((header, i) => [header, values[i]]),
    );
    assert.ok(
      item["作品ID"] && !seen.has(item["作品ID"]),
      `Duplicate/empty ID: ${item["作品ID"]}`,
    );
    seen.add(item["作品ID"]);
    return item;
  });
}

export const ossBase =
  "https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/";
export const imageColumns = [
  "缩略图 OSS 链接",
  "预览图 OSS 链接",
  "完整图 OSS 链接",
];
export function mediaPath(url) {
  assert.ok(url.startsWith(ossBase), `Unexpected asset host: ${url}`);
  const path = url.slice(ossBase.length);
  assert.match(path, /^media\/[a-zA-Z0-9_/-]+\.(?:jpg|webp)$/);
  assert.ok(!path.includes(".."), `Unsafe media path: ${path}`);
  return path;
}
