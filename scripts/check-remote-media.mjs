import {
  assetBase,
  forEachFile,
  readMediaIndex,
  verifyBytes,
} from "./lib/media-index.mjs";

const files = await readMediaIndex();
const base = assetBase();
let checked = 0;
await forEachFile(
  files,
  async (file) => {
    let failure;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(base + file.url, {
          method: "HEAD",
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error(`HEAD HTTP ${response.status}`);
        const md5 = response.headers
          .get("etag")
          ?.replaceAll('"', "")
          .toLowerCase();
        // OSS single-part ETags are MD5. Other hosts may need a body hash instead.
        if (
          Number(response.headers.get("content-length")) !== file.bytes ||
          md5 !== file.md5
        ) {
          const body = await fetch(base + file.url, {
            signal: AbortSignal.timeout(60000),
          });
          if (!body.ok) throw new Error(`GET HTTP ${body.status}`);
          verifyBytes(file, Buffer.from(await body.arrayBuffer()));
        }
        checked++;
        if (checked % 500 === 0)
          console.log(`远端媒体核验 ${checked}/${files.length}`);
        return;
      } catch (error) {
        failure = error;
      }
    }
    throw failure;
  },
  16,
);
console.log(`远端媒体核验通过：${checked} 个文件；${base}`);
