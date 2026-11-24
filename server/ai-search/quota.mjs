import OSS from 'ali-oss';
import { createHmac } from 'node:crypto';

// AppendObject atomically checks the expected position. One byte reserves one
// call, so parallel instances and cold starts cannot reset the daily budget.
export async function reserveCounter(store, key, limit) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let position = 0;
    try {
      const head = await store.head(key);
      position = Number(head.res.headers['content-length']);
    } catch (error) { if (error.status !== 404) throw error; }
    if (!Number.isSafeInteger(position) || position < 0) throw new Error('Invalid quota state');
    if (position >= limit) return false;
    try {
      await store.append(key, Buffer.from('1'), { position, headers: { 'x-oss-object-acl': 'private', 'x-oss-server-side-encryption': 'AES256' } });
      return true;
    } catch (error) { if (error.code !== 'PositionNotEqualToLength') throw error; }
  }
  throw new Error('Quota contention');
}

export async function reserveQuota(ip, context, env = process.env) {
  if (!ip || !env.QUOTA_HASH_SECRET || !env.QUOTA_BUCKET) throw new Error('Quota configuration missing');
  const credentials = context?.credentials;
  if (!credentials?.accessKeyId || !credentials?.accessKeySecret || !credentials?.securityToken) throw new Error('Role credentials missing');
  const store = new OSS({ region: 'oss-cn-shanghai', endpoint: 'https://oss-cn-shanghai-internal.aliyuncs.com', bucket: env.QUOTA_BUCKET, accessKeyId: credentials.accessKeyId, accessKeySecret: credentials.accessKeySecret, stsToken: credentials.securityToken, authorizationV4: true, timeout: 5000 });
  const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const hash = createHmac('sha256', env.QUOTA_HASH_SECRET).update(`${date}:${ip}`).digest('hex');
  const prefix = `where-is-art-private/ai-search/quota/${date}`;
  const perIP = Number(env.AI_IP_DAILY_LIMIT || 20);
  const global = Number(env.AI_DAILY_LIMIT || 100);
  if (![perIP, global].every(x => Number.isSafeInteger(x) && x > 0 && x <= 1000)) throw new Error('Invalid quota limit');
  if (!await reserveCounter(store, `${prefix}/ip-${hash}`, perIP)) return 'ip';
  if (!await reserveCounter(store, `${prefix}/all`, global)) return 'global';
  return null;
}
