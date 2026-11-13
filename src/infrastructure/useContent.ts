import { useEffect, useState } from "react";
import { version } from "../../package.json";
import { atlasSchema, validateRelations, type Atlas } from "../domain/atlas";
let cached: Atlas | undefined;
let pending: Promise<Atlas> | undefined;
async function load() {
  if (cached) return cached;
  if (!pending)
    // Keep each release's catalog with its code; only media uses the OSS base.
    pending = fetch(`${import.meta.env.BASE_URL}catalog.json?v=${version}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("内容暂时无法加载");
        const data = atlasSchema.parse(await response.json());
        if (validateRelations(data).length)
          throw new Error("内容数据校验未通过");
        cached = data;
        return data;
      })
      .finally(() => {
        pending = undefined;
      });
  return pending;
}
export function useContent() {
  const [data, setData] = useState<Atlas | undefined>(cached);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError("暂时未能读取画作资料，请重试。");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return { data, error, retry: () => setAttempt((n) => n + 1) };
}
