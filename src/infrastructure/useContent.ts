import { useEffect, useState } from "react";
import { type CatalogIndex } from "../domain/atlas";
import { loadCatalog } from "./contentDelivery";
let cached: CatalogIndex | undefined;
let pending: Promise<CatalogIndex> | undefined;
async function load() {
  if (cached) return cached;
  if (!pending)
    pending = loadCatalog()
      .then((data) => {
        cached = data;
        return data;
      })
      .finally(() => {
        pending = undefined;
      });
  return pending;
}
export function useContent() {
  const [data, setData] = useState<CatalogIndex | undefined>(cached);
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
