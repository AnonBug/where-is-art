#!/usr/bin/env node
/**
 * Prepare the supplied Tang Yin research corpus without changing its originals.
 * Run: node scripts/prepare-media.mjs [source-manifest.json]
 * ATLAS_ORIGINAL_ROOT can relocate the corpus; paths stay out of public metadata.
 * Generated images, including crops and compression, are declared derivatives.
 */
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  // Existing local workspace installation; independent checkouts use npm ci.
  sharp = require(
    path.resolve(projectRoot, "../漫览画廊/art-gallery/node_modules/sharp"),
  );
}
sharp.cache({ memory: 32, files: 8, items: 12 });
sharp.concurrency(1);

const sourceManifestPath = path.resolve(
  process.argv[2] ||
    path.join(
      projectRoot,
      "../outputs/art-atlas-handoff/test-data/tang-yin/manifest.json",
    ),
);
const sourceManifest = JSON.parse(
  await fs.readFile(sourceManifestPath, "utf8"),
);
const publicRoot = path.join(projectRoot, "public");
const outputRoot = path.join(publicRoot, "media", "tang-yin");
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "art-atlas-media-"));
const imageByteLimit = 20_000_000;
const pipelineVersion = 1;

// Chosen from full-work previews. A square is cropped from source pixels FIRST.
// These are thumbnail focal points only, never coordinates claiming registration.
const focalPoints = {
  "tang-yin-01": [0.5, 0.54],
  "tang-yin-02": [0.59, 0.5],
  "tang-yin-03": [0.5, 0.62],
  "tang-yin-04": [0.48, 0.56],
  "tang-yin-05": [0.5, 0.6],
  "tang-yin-06": [0.51, 0.6],
  "tang-yin-10": [0.51, 0.65],
  "tang-yin-11": [0.57, 0.5],
  "tang-yin-12": [0.5, 0.64],
  "tang-yin-13": [0.73, 0.5],
};
// The museum photograph has calibration strips outside the work itself.
const thumbnailScales = { "tang-yin-10": 0.68 };

const verifiedCommonsIds = new Set(["01", "02", "03", "04", "05", "09", "12"]);
function rightsFor(source) {
  const code = source.artwork_id.split("-").at(-1);
  if (source.source.includes("commons.wikimedia.org")) {
    if (code === "07")
      return {
        credit: "唐寅《落霞孤鹜图》，图像：Yoohhee1982 / Wikimedia Commons",
        licenseLabel: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        publicationStatus: "cleared",
      };
    if (verifiedCommonsIds.has(code))
      return {
        credit: `唐寅《${source.title}》，图像来源：Wikimedia Commons`,
        licenseLabel: "Public Domain（来源页标注）",
        licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
        publicationStatus: "cleared",
      };
  }
  if (source.kind.includes("CC BY 4.0"))
    return {
      credit: `唐寅《${source.title}》，国立故宫博物院，台北`,
      licenseLabel: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      publicationStatus: "cleared",
    };
  if (source.source.includes("clevelandart.org"))
    return {
      credit: `唐寅《${source.title}》，克利夫兰艺术博物馆，1969.116`,
      licenseLabel: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      publicationStatus: "cleared",
    };
  if (source.source.includes("metmuseum.org"))
    return {
      credit: `唐寅《${source.title}》，大都会艺术博物馆`,
      licenseLabel: "Public Domain / Open Access",
      licenseUrl: "https://www.metmuseum.org/policies/image-resources",
      publicationStatus: "cleared",
    };
  const credit = source.source.includes("shanghaimuseum.net")
    ? `唐寅《${source.title}》，上海博物馆公开图像`
    : source.source.includes("heritagemuseum.gov.hk")
      ? `唐寅《${source.title}》，南京博物院提供，香港文化博物馆展览图像`
      : `唐寅《${source.title}》，China Online Museum / Flickr`;
  return {
    credit,
    licenseLabel: "使用条款待核实",
    publicationStatus: "review-required",
  };
}

async function hashFile(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}
async function imageMetadata(filename, prefix) {
  const metadata = await sharp(filename, {
    limitInputPixels: false,
  }).metadata();
  return {
    url: `${prefix}/${path.basename(filename)}`,
    width: metadata.width,
    height: metadata.height,
    bytes: (await fs.stat(filename)).size,
  };
}
function sourcePipeline(filename, width, height) {
  return sharp(filename, { limitInputPixels: false, sequentialRead: true })
    .resize(width, height, { fit: "fill", withoutEnlargement: true })
    .toColourspace("srgb");
}
async function writeBoundedMaster(sourceFile, source, workingDirectory) {
  let width = source.width;
  let height = source.height;
  const fixed =
    source.artwork_id === "tang-yin-01" || source.artwork_id === "tang-yin-02";
  if (source.artwork_id === "tang-yin-01") [width, height] = [6845, 12694];
  const filename = path.join(workingDirectory, "bounded-master.jpg");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (const quality of fixed ? [86] : [90, 88, 86]) {
      const info = await sourcePipeline(sourceFile, width, height)
        .jpeg({ quality, chromaSubsampling: "4:4:4" })
        .toFile(filename);
      if (info.size <= imageByteLimit)
        return {
          width: info.width,
          height: info.height,
          bytes: info.size,
          quality,
        };
    }
    if (fixed)
      throw new Error(
        `${source.title}: approved dimensions/quality exceed 20 MB; review required`,
      );
    width = Math.round(width * 0.9);
    height = Math.round((source.height * width) / source.width);
  }
  throw new Error(`${source.title}: no acceptable bounded delivery found`);
}
async function tileStats(directory) {
  let tileCount = 0;
  let totalBytes = 0;
  let maxTileBytes = 0;
  for (const level of await fs.readdir(directory, { withFileTypes: true })) {
    if (!level.isDirectory()) continue;
    for (const name of await fs.readdir(path.join(directory, level.name))) {
      if (!/\.jpe?g$/.test(name)) continue;
      const bytes = (await fs.stat(path.join(directory, level.name, name)))
        .size;
      tileCount += 1;
      totalBytes += bytes;
      maxTileBytes = Math.max(maxTileBytes, bytes);
    }
  }
  return { tileCount, totalBytes, maxTileBytes };
}

await fs.mkdir(outputRoot, { recursive: true });
const images = [];
const sourceHashes = [];
try {
  for (const [index, source] of sourceManifest.images.entries()) {
    const sourceFile = process.env.ATLAS_ORIGINAL_ROOT
      ? path.resolve(process.env.ATLAS_ORIGINAL_ROOT, source.file)
      : source.local_path;
    if (
      !sourceFile ||
      path.resolve(sourceFile).startsWith(publicRoot + path.sep)
    )
      throw new Error("Source originals must be outside public/");
    const actualHash = await hashFile(sourceFile);
    if (actualHash !== source.sha256)
      throw new Error(`Source hash mismatch: ${source.file}`);
    const meta = await sharp(sourceFile, {
      limitInputPixels: false,
    }).metadata();
    if (meta.width !== source.width || meta.height !== source.height)
      throw new Error(`Source dimensions mismatch: ${source.file}`);
    if (meta.orientation && meta.orientation !== 1)
      throw new Error(
        `Unexpected EXIF orientation: ${source.file}; explicit review required`,
      );
    const detailNumber =
      source.role === "detail"
        ? Number(source.file.match(/局部(\d+)/)?.[1])
        : 0;
    const id =
      source.role === "detail"
        ? `${source.artwork_id}-detail-${String(detailNumber).padStart(2, "0")}`
        : `${source.artwork_id}-whole`;
    const prefix = `media/tang-yin/${id}`;
    const dest = path.join(outputRoot, id);
    const staging = await fs.mkdtemp(path.join(outputRoot, ".prepare-"));
    const workingDirectory = path.join(scratch, id);
    await fs.mkdir(workingDirectory);
    console.log(
      `[${index + 1}/${sourceManifest.images.length}] ${id}: verified source; preparing ${source.suggested_delivery}`,
    );

    try {
      const cropScale =
        source.role === "whole" ? thumbnailScales[source.artwork_id] || 1 : 1;
      const cropSide = Math.round(
        Math.min(meta.width, meta.height) * cropScale,
      );
      const [fx, fy] =
        source.role === "whole"
          ? focalPoints[source.artwork_id] || [0.5, 0.5]
          : [0.5, 0.5];
      const crop = {
        left: Math.max(
          0,
          Math.min(
            meta.width - cropSide,
            Math.round(meta.width * fx - cropSide / 2),
          ),
        ),
        top: Math.max(
          0,
          Math.min(
            meta.height - cropSide,
            Math.round(meta.height * fy - cropSide / 2),
          ),
        ),
        width: cropSide,
        height: cropSide,
      };
      const thumbFile = path.join(staging, "thumb.webp");
      await sharp(sourceFile, { limitInputPixels: false, sequentialRead: true })
        .extract(crop)
        .resize(320, 320, { withoutEnlargement: true })
        .toColourspace("srgb")
        .webp({ quality: 82 })
        .toFile(thumbFile);
      const thumbnail = await imageMetadata(thumbFile, prefix);
      if (thumbnail.bytes > 100_000)
        throw new Error(`${id}: thumbnail exceeds 100 KB`);

      let previewFile = path.join(staging, "preview.webp");
      await sharp(sourceFile, { limitInputPixels: false, sequentialRead: true })
        .resize({
          width: 1280,
          height: 1280,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toColourspace("srgb")
        .webp({ quality: 85 })
        .toFile(previewFile);
      if (
        meta.format === "jpeg" &&
        Math.max(meta.width, meta.height) <= 1280 &&
        source.bytes < (await fs.stat(previewFile)).size
      ) {
        await fs.rm(previewFile);
        previewFile = path.join(staging, "preview.jpg");
        await fs.copyFile(sourceFile, previewFile);
      }
      const preview = await imageMetadata(previewFile, prefix);
      if (preview.bytes > 500_000)
        throw new Error(`${id}: preview exceeds 500 KB`);

      let delivery;
      let processing;
      if (source.suggested_delivery === "dzi") {
        const bounded = await writeBoundedMaster(
          sourceFile,
          source,
          workingDirectory,
        );
        // Encode the pyramid DIRECTLY from source, using the same bounded dimensions.
        await sourcePipeline(sourceFile, bounded.width, bounded.height)
          .jpeg({ quality: bounded.quality, chromaSubsampling: "4:4:4" })
          .tile({ size: 512, overlap: 1, layout: "dz", depth: "onepixel" })
          .toFile(path.join(staging, "detail"));
        await fs.rm(path.join(staging, "detail_files", "vips-properties.xml"), {
          force: true,
        });
        delivery = {
          kind: "dzi",
          url: `${prefix}/detail.dzi`,
          width: bounded.width,
          height: bounded.height,
          tileSize: 512,
          overlap: 1,
          ...(await tileStats(path.join(staging, "detail_files"))),
        };
        processing = {
          pipelineVersion,
          format: "jpeg",
          quality: bounded.quality,
          chromaSubsampling: "4:4:4",
          colourspace: "srgb",
          sourceWidth: source.width,
          sourceHeight: source.height,
          boundedMasterBytes: bounded.bytes,
          boundedMasterPublished: false,
        };
      } else {
        const detailFile = path.join(staging, "detail.jpg");
        if (meta.format === "jpeg" && source.bytes <= imageByteLimit) {
          await fs.copyFile(sourceFile, detailFile);
          processing = {
            pipelineVersion,
            format: "jpeg",
            sourcePreserved: true,
            sourceWidth: source.width,
            sourceHeight: source.height,
          };
        } else {
          const bounded = await writeBoundedMaster(
            sourceFile,
            source,
            workingDirectory,
          );
          await fs.copyFile(
            path.join(workingDirectory, "bounded-master.jpg"),
            detailFile,
          );
          processing = {
            pipelineVersion,
            format: "jpeg",
            quality: bounded.quality,
            chromaSubsampling: "4:4:4",
            colourspace: "srgb",
            sourceWidth: source.width,
            sourceHeight: source.height,
          };
        }
        delivery = {
          kind: "image",
          ...(await imageMetadata(detailFile, prefix)),
          format: "jpeg",
        };
        if (delivery.bytes > imageByteLimit)
          throw new Error(`${id}: delivered image exceeds 20 MB`);
      }
      const image = {
        id,
        artworkId: source.artwork_id,
        role: source.role,
        label: source.role === "whole" ? "全图" : `局部 ${detailNumber}`,
        order: detailNumber,
        width: delivery.width,
        height: delivery.height,
        thumbnail,
        preview,
        delivery,
        sourceUrl: source.source,
        sourceImageUrl: source.image_url,
        sourceHash: actualHash,
        ...rightsFor(source),
        quality:
          source.suggested_delivery === "low-resolution" ? "standard" : "high",
        processing,
        thumbnailCrop: crop,
      };
      // Never replace an earlier complete version before this asset has succeeded.
      const previous = path.join(outputRoot, `.previous-${id}`);
      await fs.rm(previous, { recursive: true, force: true });
      try {
        await fs.rename(dest, previous);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await fs.rename(staging, dest);
      await fs.rm(previous, { recursive: true, force: true });
      images.push(image);
      sourceHashes.push({ id, sourceFile, expected: actualHash });
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
      await fs.rm(workingDirectory, { recursive: true, force: true });
    }
  }
  for (const source of sourceHashes)
    if ((await hashFile(source.sourceFile)) !== source.expected)
      throw new Error(`Original changed during processing: ${source.id}`);
  await fs.mkdir(path.join(projectRoot, "content"), { recursive: true });
  const manifest = { version: 1, images };
  const manifestFile = path.join(projectRoot, "content/media-manifest.json");
  await fs.writeFile(
    `${manifestFile}.tmp`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await fs.rename(`${manifestFile}.tmp`, manifestFile);
  console.log(
    JSON.stringify(
      {
        images: images.length,
        artworks: new Set(images.map((x) => x.artworkId)).size,
        dzi: images.filter((x) => x.delivery.kind === "dzi").length,
        originalHashesVerifiedBeforeAndAfter: sourceHashes.length,
        pendingRights: images
          .filter((x) => x.publicationStatus === "review-required")
          .map((x) => x.id),
      },
      null,
      2,
    ),
  );
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
