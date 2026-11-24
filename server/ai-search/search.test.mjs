import { describe, it, expect, vi } from 'vitest';
import { prepareCatalog, validatePlan, searchCatalog, keywordSearch } from './search.mjs';
import { reserveCounter } from './quota.mjs';
import { createHandler } from './index.mjs';

const revision = 'a'.repeat(20);
const data = { artists: [{ id: 'monet', name: '莫奈' }, { id: 'rembrandt', name: '伦勃朗' }], topics: [{ id: 'portrait', title: '自画像', artworkIds: ['c'] }], venues: [{ id: 'orsay', name: '奥赛博物馆', city: '巴黎', country: '法国' }, { id: 'london', name: '国家美术馆', city: '伦敦', country: '英国' }], artworks: [{ id: 'a', title: '睡莲', artistIds: ['monet'] }, { id: 'b', title: '桥', artistIds: ['monet'] }, { id: 'c', title: '自画像', artistIds: ['rembrandt'] }, { id: 'hidden', title: '睡莲未配图', artistIds: ['monet'] }], holdings: [{ artworkId: 'a', venueId: 'orsay' }, { artworkId: 'b', venueId: 'london' }, { artworkId: 'c', venueId: 'london' }], images: ['a', 'b', 'c'].map(artworkId => ({ artworkId, role: 'whole' })) };
const catalog = prepareCatalog(data, revision);
describe('catalog-grounded search', () => {
  it('combines artist and collection city, without inventing results or showing works without images', () => {
    const plan = validatePlan({ artistIds: ['monet'], places: ['巴黎'] }, catalog);
    expect(searchCatalog(catalog, plan, '巴黎的莫奈').results).toEqual([{ id: 'a', reason: '莫奈 · 奥赛博物馆（巴黎）' }]);
  });
  it('rejects unknown IDs, malformed filters and unsupported requests', () => {
    expect(() => validatePlan({ artistIds: ['invented'] }, catalog)).toThrow();
    expect(() => validatePlan({ terms: '睡莲' }, catalog)).toThrow();
    expect(searchCatalog(catalog, validatePlan({}, catalog), 'anything').results).toEqual([]);
    expect(keywordSearch(catalog, '伦勃朗').results.map(x => x.id)).toEqual(['c']);
  });
});
describe('persistent quota', () => {
  it('does not overspend under concurrent reservations', async () => {
    let size = 0;
    const store = { head: async () => ({ res: { headers: { 'content-length': String(size) } } }), append: async (_key, body, options) => { await Promise.resolve(); if (options.position !== size) throw { code: 'PositionNotEqualToLength' }; expect(options.headers['x-oss-object-acl']).toBe('private'); size += body.length; } };
    const results = await Promise.all(Array.from({ length: 6 }, () => reserveCounter(store, 'all', 3)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(size).toBe(3);
  });
  it('fails closed when quota storage is unavailable', async () => {
    await expect(reserveCounter({ head: async () => { throw { status: 403 }; } }, 'all', 100)).rejects.toEqual({ status: 403 });
  });
});
const event = (body = { query: '莫奈', revision }, extra = {}) => ({ rawPath: '/api/ai-search', requestContext: { http: { method: 'POST', sourceIp: '192.0.2.1' } }, headers: { 'Content-Type': 'application/json', Origin: 'https://anonbug.github.io' }, body: JSON.stringify(body), ...extra });
describe('HTTP boundary', () => {
  it('pins catalog revision, returns browser CORS, and reuses successful answers without another paid call', async () => {
    let clock = 10000;
    const getCatalog = vi.fn(async () => catalog), reserve = vi.fn(async () => null), plan = vi.fn(async () => validatePlan({ artistIds: ['monet'] }, catalog));
    const handler = createHandler({ getCatalog, reserve, plan, now: () => clock });
    const first = await handler(event(), {});
    expect(first.statusCode).toBe(200); expect(first.headers['Access-Control-Allow-Origin']).toBe('https://anonbug.github.io');
    expect(getCatalog).toHaveBeenCalledWith(revision);
    clock += 1100;
    expect(JSON.parse((await handler(event(), {})).body).cached).toBe(true);
    expect(reserve).toHaveBeenCalledTimes(1); expect(plan).toHaveBeenCalledTimes(1);
  });
  it.each(['global', 'ip', 'failure'])('uses keyword fallback without calling DeepSeek when quota is %s', async reason => {
    const plan = vi.fn();
    const handler = createHandler({ getCatalog: async () => catalog, plan, reserve: async () => { if (reason === 'failure') throw new Error(); return reason; } });
    const result = JSON.parse((await handler(event(), {})).body);
    expect(result.mode).toBe('keyword'); expect(result.results.map(x => x.id)).toEqual(['a', 'b']); expect(plan).not.toHaveBeenCalled();
  });
  it('rejects oversized queries, bad revisions and unapproved origins before model/quota calls', async () => {
    const reserve = vi.fn(), plan = vi.fn(); const handler = createHandler({ reserve, plan });
    expect((await handler(event({ query: 'x'.repeat(201) }), {})).statusCode).toBe(400);
    expect((await handler(event({ query: 'a', revision: '../../x' }), {})).statusCode).toBe(400);
    expect((await handler(event(undefined, { headers: { Origin: 'https://elsewhere.example' } }), {})).statusCode).toBe(403);
    expect(reserve).not.toHaveBeenCalled(); expect(plan).not.toHaveBeenCalled();
  });
});
