import {
  prepareCatalog,
  plannerPrompt,
  validatePlan,
  searchCatalog,
  keywordSearch,
  normalize,
} from "./search.mjs";
import { reserveQuota } from "./quota.mjs";
import { createHash } from "node:crypto";
import { CORPUS_FILE, createSearchCorpus } from "./corpus.mjs";
import { addVisualAnnotations } from "./visual.mjs";
import { createVisualLoader } from "./visual-source.mjs";
import {
  retrieveCandidates,
  reviewMessages,
  reviewedResults,
} from "./retrieval.mjs";

const ROOT =
  "https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/content/";

async function getJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok)
    throw Object.assign(new Error("Catalog unavailable"), {
      status: response.status,
    });
  return response.json();
}
export function createCatalogLoader({
  fetchJson = getJson,
  loadVisual = createVisualLoader(),
} = {}) {
  const catalogs = new Map(),
    bases = new Map(),
    pending = new Map();
  async function loadBase(revision) {
    if (bases.has(revision)) return bases.get(revision);
    if (pending.has(revision)) return pending.get(revision);
    const task = (async () => {
      const data = await fetchJson(
        `${ROOT}releases/${revision}/catalog-index.json`,
      );
      if (data.detailBase !== `artwork-details/${revision}/`)
        throw new Error("Revision mismatch");
      let corpus;
      try {
        corpus = await fetchJson(`${ROOT}releases/${revision}/${CORPUS_FILE}`);
      } catch (error) {
        if (error.status !== 404) throw error;
        const full = await fetchJson(
          `${ROOT}releases/${revision}/catalog.json`,
        );
        const digest = createHash("sha256")
          .update("art-atlas-content-v1\n")
          .update(JSON.stringify(full))
          .digest("hex")
          .slice(0, 20);
        if (digest !== revision) throw new Error("Revision mismatch");
        corpus = createSearchCorpus(full, revision);
      }
      if (bases.size >= 3) bases.delete(bases.keys().next().value);
      bases.set(revision, { data, corpus });
      return { data, corpus };
    })();
    pending.set(revision, task);
    try {
      return await task;
    } finally {
      pending.delete(revision);
    }
  }
  return async function loadCatalog(revision, visual = false) {
    if (!revision) revision = (await fetchJson(`${ROOT}current.json`)).revision;
    if (!/^[a-f0-9]{20}$/.test(revision)) throw new Error("Invalid revision");
    // Always check the remote visual TTL before reusing a prepared catalog.
    const snapshot = visual ? await loadVisual() : null;
    const cacheKey = `${revision}:${snapshot?.revision || "none"}`;
    if (catalogs.has(cacheKey))
      return {
        ...catalogs.get(cacheKey),
        visualStale: snapshot?.stale || false,
      };
    const { data, corpus } = await loadBase(revision);
    const catalog = prepareCatalog(
      data,
      revision,
      snapshot ? addVisualAnnotations(data, corpus, snapshot) : corpus,
    );
    catalog.visualRevision = snapshot?.revision || "none";
    if (catalogs.size >= 3) catalogs.delete(catalogs.keys().next().value);
    catalogs.set(cacheKey, catalog);
    return { ...catalog, visualStale: snapshot?.stale || false };
  };
}
const loadCatalog = createCatalogLoader();
async function askModel(messages, maxTokens) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("Model unavailable");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-flash",
      messages,
      thinking: { type: "disabled" },
      max_tokens: maxTokens,
      stream: false,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error("Model unavailable");
  const data = await response.json();
  if (data.choices?.[0]?.finish_reason !== "stop")
    throw new Error("Incomplete plan");
  return JSON.parse(data.choices[0].message.content);
}
async function planQuery(catalog, query) {
  return validatePlan(
    await askModel(
      [
        { role: "system", content: plannerPrompt(catalog) },
        { role: "user", content: query },
      ],
      600,
    ),
    catalog,
  );
}
async function reviewQuery(candidates, query) {
  return askModel(reviewMessages(query, candidates), 1000);
}

export function createHandler({
  getCatalog = loadCatalog,
  plan = planQuery,
  review = reviewQuery,
  reserve = reserveQuota,
  env = process.env,
  now = Date.now,
} = {}) {
  const cache = new Map();
  const recent = new Map();
  return async (raw, context) => {
    let event;
    try {
      event =
        Buffer.isBuffer(raw) || typeof raw === "string"
          ? JSON.parse(raw.toString())
          : raw;
    } catch {
      return { statusCode: 400, body: '{"message":"请求格式不正确"}' };
    }
    const headers = Object.fromEntries(
      Object.entries(event?.headers || {}).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    );
    const origin = headers.origin;
    const allowed = (env.ALLOWED_ORIGINS || "https://anonbug.github.io")
      .split(",")
      .map((x) => x.trim());
    const cors = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(origin && allowed.includes(origin)
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "600",
          }
        : {}),
    };
    const reply = (statusCode, body) => ({
      statusCode,
      headers: cors,
      isBase64Encoded: false,
      body: JSON.stringify(body),
    });
    const method = event?.requestContext?.http?.method;
    const path = event?.rawPath;
    if (origin && !allowed.includes(origin))
      return reply(403, { message: "此来源暂未开放搜索" });
    if (method === "GET" && path === "/health")
      return reply(200, {
        service: "where-is-art-ai-search",
        ready: Boolean(
          env.DEEPSEEK_API_KEY && env.QUOTA_HASH_SECRET && env.QUOTA_BUCKET,
        ),
      });
    if (path !== "/api/ai-search") return reply(404, { message: "接口不存在" });
    if (method === "OPTIONS") return reply(204, null);
    if (method !== "POST") return reply(405, { message: "请使用 POST 请求" });
    if (!String(headers["content-type"] || "").startsWith("application/json"))
      return reply(415, { message: "请使用 JSON 格式" });
    if (typeof event.body !== "string" || event.body.length > 6000)
      return reply(413, { message: "搜索内容过长" });
    let input;
    try {
      input = JSON.parse(
        event.isBase64Encoded
          ? Buffer.from(event.body, "base64").toString("utf8")
          : event.body,
      );
    } catch {
      return reply(400, { message: "请求格式不正确" });
    }
    if (
      !input ||
      typeof input.query !== "string" ||
      input.query.trim().length < 1 ||
      input.query.length > 200 ||
      !["ai", "keyword", undefined].includes(input.mode) ||
      (input.visualAnnotations !== undefined &&
        typeof input.visualAnnotations !== "boolean") ||
      (input.revision !== undefined && !/^[a-f0-9]{20}$/.test(input.revision))
    )
      return reply(400, { message: "请输入 1–200 字的搜索内容" });
    const query = input.query.trim();
    const ip = event.requestContext?.http?.sourceIp;
    if (!ip) return reply(400, { message: "无法确认请求来源" });
    // The trusted FC sourceIp is used instead of client-supplied forwarded headers.
    if (recent.has(ip) && now() - recent.get(ip) < 1000)
      return reply(429, { message: "搜索太快，请稍等片刻" });
    recent.set(ip, now());
    if (recent.size > 2000)
      for (const [key, time] of recent)
        if (now() - time > 60_000) recent.delete(key);
    try {
      // Existing open clients only accept the original evidence fields.
      const catalog =
        input.visualAnnotations === true
          ? await getCatalog(input.revision, true)
          : await getCatalog(input.revision);
      const visualMeta =
        input.visualAnnotations === true
          ? {
              visualCount: catalog.visualCount || 0,
              visualRevision: catalog.visualRevision || "none",
              visualStale: catalog.visualStale || false,
            }
          : {};
      const freshnessNote = catalog.visualStale
        ? catalog.visualCount
          ? " 视觉标注更新暂时不可用，当前使用最近一次成功读取的版本。"
          : " 视觉标注暂时无法读取，本次仅检索原有作品资料。"
        : "";
      const fallback = (message) =>
        reply(200, {
          ...keywordSearch(catalog, query),
          revision: catalog.revision,
          mode: "keyword",
          visualCount: catalog.visualCount || 0,
          ...visualMeta,
          message: message + freshnessNote,
        });
      if (input.mode === "keyword")
        return fallback(
          "按关键词匹配画名、馆藏和已收录的作品文字与标注，未进行 AI 语义核对",
        );
      const cacheKey = `${catalog.revision}:${input.visualAnnotations === true}:${catalog.visualRevision || "none"}:${Boolean(catalog.visualStale)}:${normalize(query)}`;
      const cached = cache.get(cacheKey);
      if (cached && now() - cached.time < 3600_000)
        return reply(200, { ...cached.result, cached: true });
      let quota;
      try {
        quota = await reserve(ip, context);
      } catch {
        return fallback("AI 搜索暂时不可用，已改用关键词搜索");
      }
      if (quota)
        return fallback(
          quota === "ip"
            ? "今日 AI 搜索次数已用完，仍可使用关键词搜索"
            : "今日 AI 搜索额度已用完，仍可使用关键词搜索",
        );
      let planned;
      try {
        planned = await plan(catalog, query);
      } catch {
        return fallback("AI 搜索暂时不可用，已改用关键词搜索");
      }
      let result;
      if (!planned.unsupported && planned.contentTerms?.length) {
        const { candidates, matchedCount } = retrieveCandidates(
          catalog,
          planned,
          query,
        );
        let checked = { total: 0, results: [], semantic: true };
        if (candidates.length) {
          // Each paid model request has its own durable reservation. A story
          // search normally consumes two requests; cached searches consume none.
          try {
            quota = await reserve(ip, context);
          } catch {
            return fallback("AI 语义核对暂时不可用，以下仅为关键词匹配");
          }
          if (quota)
            return fallback("今日 AI 调用额度已用完，以下仅为关键词匹配");
          try {
            checked = reviewedResults(
              await review(candidates, query),
              candidates,
              planned,
            );
          } catch {
            return fallback("AI 语义核对暂时不可用，以下仅为关键词匹配");
          }
        }
        result = {
          ...checked,
          revision: catalog.revision,
          mode: "ai",
          visualCount: catalog.visualCount || 0,
          limited: matchedCount > candidates.length,
          message: checked.total
            ? `已核对作品文字${catalog.visualCount ? "与 AI 视觉标注" : ""}，结果附匹配依据。${matchedCount > candidates.length ? "本次核对最相关的 20 幅候选，可补充条件继续查找。" : ""}`
            : "已检索现有资料，暂未找到有充分依据的作品；未标注的画面可能无法按情绪或细节搜到。",
        };
      } else
        result = {
          ...searchCatalog(catalog, planned, query),
          revision: catalog.revision,
          mode: "ai",
          message: planned.unsupported
            ? "暂不支持此查询，可尝试画名、画家、故事情节或收藏地点"
            : "依据站内已收录作品匹配，收藏地点不代表实时展出",
        };
      if (cache.size >= 256) cache.delete(cache.keys().next().value);
      result = {
        ...result,
        ...visualMeta,
        message: result.message + freshnessNote,
      };
      cache.set(cacheKey, { time: now(), result });
      return reply(200, result);
    } catch {
      return reply(503, { message: "作品目录暂时无法读取，请稍后再试" });
    }
  };
}
export const handler = createHandler();
