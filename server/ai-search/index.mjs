import { prepareCatalog, plannerPrompt, validatePlan, searchCatalog, keywordSearch, normalize } from './search.mjs';
import { reserveQuota } from './quota.mjs';

const ROOT = 'https://halfbvg-art-assets.oss-cn-shanghai.aliyuncs.com/where-is-art/content/';
const catalogs = new Map();

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!response.ok) throw new Error('Catalog unavailable');
  return response.json();
}
async function loadCatalog(revision) {
  if (!revision) revision = (await getJson(`${ROOT}current.json`)).revision;
  if (!/^[a-f0-9]{20}$/.test(revision)) throw new Error('Invalid revision');
  if (catalogs.has(revision)) return catalogs.get(revision);
  const data = await getJson(`${ROOT}releases/${revision}/catalog-index.json`);
  if (data.detailBase !== `artwork-details/${revision}/`) throw new Error('Revision mismatch');
  const catalog = prepareCatalog(data, revision);
  if (catalogs.size >= 3) catalogs.delete(catalogs.keys().next().value);
  catalogs.set(revision, catalog);
  return catalog;
}
async function planQuery(catalog, query) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('Model unavailable');
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: 'deepseek-flash', messages: [{ role: 'system', content: plannerPrompt(catalog) }, { role: 'user', content: query }], thinking: { type: 'disabled' }, max_tokens: 400, stream: false, response_format: { type: 'json_object' } }),
  });
  if (!response.ok) throw new Error('Model unavailable');
  const data = await response.json();
  if (data.choices?.[0]?.finish_reason !== 'stop') throw new Error('Incomplete plan');
  return validatePlan(JSON.parse(data.choices[0].message.content), catalog);
}

export function createHandler({ getCatalog = loadCatalog, plan = planQuery, reserve = reserveQuota, env = process.env, now = Date.now } = {}) {
  const cache = new Map();
  const recent = new Map();
  return async (raw, context) => {
    let event;
    try { event = Buffer.isBuffer(raw) || typeof raw === 'string' ? JSON.parse(raw.toString()) : raw; } catch { return { statusCode: 400, body: '{"message":"请求格式不正确"}' }; }
    const headers = Object.fromEntries(Object.entries(event?.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const origin = headers.origin;
    const allowed = (env.ALLOWED_ORIGINS || 'https://anonbug.github.io').split(',').map(x => x.trim());
    const cors = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } : {}) };
    const reply = (statusCode, body) => ({ statusCode, headers: cors, isBase64Encoded: false, body: JSON.stringify(body) });
    const method = event?.requestContext?.http?.method;
    const path = event?.rawPath;
    if (origin && !allowed.includes(origin)) return reply(403, { message: '此来源暂未开放搜索' });
    if (method === 'GET' && path === '/health') return reply(200, { service: 'where-is-art-ai-search', ready: Boolean(env.DEEPSEEK_API_KEY && env.QUOTA_HASH_SECRET && env.QUOTA_BUCKET) });
    if (path !== '/api/ai-search') return reply(404, { message: '接口不存在' });
    if (method === 'OPTIONS') return reply(204, null);
    if (method !== 'POST') return reply(405, { message: '请使用 POST 请求' });
    if (!String(headers['content-type'] || '').startsWith('application/json')) return reply(415, { message: '请使用 JSON 格式' });
    if (typeof event.body !== 'string' || event.body.length > 6000) return reply(413, { message: '搜索内容过长' });
    let input;
    try { input = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch { return reply(400, { message: '请求格式不正确' }); }
    if (!input || typeof input.query !== 'string' || input.query.trim().length < 1 || input.query.length > 200 || !['ai', 'keyword', undefined].includes(input.mode) || (input.revision !== undefined && !/^[a-f0-9]{20}$/.test(input.revision))) return reply(400, { message: '请输入 1–200 字的搜索内容' });
    const query = input.query.trim();
    const ip = event.requestContext?.http?.sourceIp;
    if (!ip) return reply(400, { message: '无法确认请求来源' });
    // The trusted FC sourceIp is used instead of client-supplied forwarded headers.
    if (recent.has(ip) && now() - recent.get(ip) < 1000) return reply(429, { message: '搜索太快，请稍等片刻' });
    recent.set(ip, now());
    if (recent.size > 2000) for (const [key, time] of recent) if (now() - time > 60_000) recent.delete(key);
    try {
      const catalog = await getCatalog(input.revision);
      const fallback = (message) => reply(200, { ...keywordSearch(catalog, query), revision: catalog.revision, mode: 'keyword', message });
      if (input.mode === 'keyword') return fallback('按画名、画家和收藏地点查找');
      const cacheKey = `${catalog.revision}:${normalize(query)}`;
      const cached = cache.get(cacheKey);
      if (cached && now() - cached.time < 3600_000) return reply(200, { ...cached.result, cached: true });
      let quota;
      try { quota = await reserve(ip, context); } catch { return fallback('AI 搜索暂时不可用，已改用关键词搜索'); }
      if (quota) return fallback(quota === 'ip' ? '今日 AI 搜索次数已用完，仍可使用关键词搜索' : '今日 AI 搜索额度已用完，仍可使用关键词搜索');
      let planned;
      try { planned = await plan(catalog, query); } catch { return fallback('AI 搜索暂时不可用，已改用关键词搜索'); }
      const result = { ...searchCatalog(catalog, planned, query), revision: catalog.revision, mode: 'ai', message: planned.unsupported ? '目前可按画名、画家、站内专题和收藏地点搜索，请换一种描述' : '依据站内已收录作品匹配，收藏地点不代表实时展出' };
      if (cache.size >= 256) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, { time: now(), result });
      return reply(200, result);
    } catch { return reply(503, { message: '作品目录暂时无法读取，请稍后再试' }); }
  };
}
export const handler = createHandler();
