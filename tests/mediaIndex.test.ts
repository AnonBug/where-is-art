import { afterEach, expect, it } from "vitest";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import index from "../content/media-index.json";

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "art-media-index-"));
  temporary.push(directory);
  for (const item of [
    "content",
    "public/catalog.json",
    "public/assets/images.json",
  ]) {
    const target = join(directory, item);
    mkdirSync(resolve(target, ".."), { recursive: true });
    cpSync(resolve(item), target, { recursive: true });
  }
  return directory;
}
function run(
  directory: string,
  script = "check-media-index.mjs",
  args: string[] = [],
) {
  return spawnSync(process.execPath, [resolve("scripts", script), ...args], {
    cwd: directory,
    encoding: "utf8",
  });
}

it.each(["missing tile", "wrong size", "unsafe path", "wrong hash"])(
  "rejects a media index with %s without requiring local images",
  (problem) => {
    const directory = fixture();
    const copy = structuredClone(index);
    const tile = copy.files.findIndex((file) =>
      file.url.includes("detail_files/"),
    );
    const image = copy.files.find(
      (file) =>
        file.url.startsWith("media/foreign/") &&
        file.url.endsWith("thumb.webp"),
    )!;
    if (problem === "missing tile") copy.files.splice(tile, 1);
    else if (problem === "wrong size") image.bytes++;
    else if (problem === "unsafe path") image.url = "media/../escape.jpg";
    else image.sha256 = "0".repeat(64);
    writeFileSync(
      join(directory, "content/media-index.json"),
      JSON.stringify(copy),
    );
    const result = run(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("AssertionError");
    expect(result.stderr).not.toContain("ENOENT");
  },
);

it("restores verified local copies and refuses to overwrite an edited file", () => {
  const directory = fixture();
  const backup = join(directory, "backup");
  const bytes = Buffer.from("media restoration fixture");
  const file = {
    url: "brand/logo.png",
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    md5: createHash("md5").update(bytes).digest("hex"),
  };
  writeFileSync(
    join(directory, "content/media-index.json"),
    JSON.stringify({ version: 1, files: [file] }),
  );
  mkdirSync(join(backup, "brand"), { recursive: true });
  writeFileSync(join(backup, file.url), bytes);
  expect(run(directory, "restore-media.mjs", ["--from", backup]).status).toBe(
    0,
  );
  const target = join(directory, "public", file.url);
  expect(readFileSync(target)).toEqual(bytes);
  expect(run(directory, "restore-media.mjs", ["--from", backup]).status).toBe(
    0,
  );
  writeFileSync(target, "local edit");
  expect(
    run(directory, "restore-media.mjs", ["--from", backup]).status,
  ).not.toBe(0);
  expect(readFileSync(target, "utf8")).toBe("local edit");
});
