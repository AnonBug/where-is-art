// Usage: node scripts/deploy-ai-search.mjs /absolute/path/to/.env.local
// Credentials are read only in memory. Temporary request files are private and removed.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';

const region = 'cn-shanghai';
const name = 'where-is-art-ai-search';
const roleName = 'WhereIsArtAiSearchRole';
const policyName = 'WhereIsArtAiSearchQuota';
const directory = mkdtempSync(join(tmpdir(), 'art-ai-deploy-'));
let key;
function cli(product, action, args = [], body) {
  const argv = [product, action, '--region', region, ...args];
  if (body) {
    const path = join(directory, 'request.json');
    writeFileSync(path, JSON.stringify(body), { mode: 0o600 });
    argv.push('--body-file', path);
  }
  const result = spawnSync('aliyun', argv, { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  if (result.status !== 0) {
    // Never emit raw CLI output: it may contain request bodies with credentials.
    const code = (result.stderr + result.stdout).match(/(?:Code:|"(?:code|Code|error_code)"\s*:)\s*"?([A-Za-z0-9_.-]+)/)?.[1] || 'CLIError';
    throw Object.assign(new Error(`${product} ${action} failed (${code})`), { code });
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}
try {
  if (!process.argv[2]) throw new Error('Provide the private DeepSeek environment file path');
  key = parseEnv(readFileSync(resolve(process.argv[2]), 'utf8')).DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY missing');
  const identity = cli('sts', 'GetCallerIdentity');
  const account = identity.AccountId;
  try { cli('ram', 'GetRole', ['--RoleName', 'AliyunServiceRoleForFC']); }
  catch (error) {
    if (!error.code.startsWith('EntityNotExist')) throw error;
    cli('ram', 'CreateServiceLinkedRole', ['--ServiceName', 'fc.aliyuncs.com']);
  }
  let role;
  try { role = cli('ram', 'GetRole', ['--RoleName', roleName]).Role; }
  catch (error) {
    if (!error.code.startsWith('EntityNotExist')) throw error;
    role = cli('ram', 'CreateRole', ['--RoleName', roleName, '--AssumeRolePolicyDocument', JSON.stringify({ Version: '1', Statement: [{ Effect: 'Allow', Action: 'sts:AssumeRole', Principal: { Service: ['fc.aliyuncs.com'] } }] })]).Role;
  }
  try { cli('ram', 'GetPolicy', ['--PolicyType', 'Custom', '--PolicyName', policyName]); }
  catch (error) {
    if (!error.code.startsWith('EntityNotExist')) throw error;
    cli('ram', 'CreatePolicy', ['--PolicyName', policyName, '--PolicyDocument', JSON.stringify({ Version: '1', Statement: [{ Effect: 'Allow', Action: ['oss:GetObject', 'oss:PutObject'], Resource: [`acs:oss:*:${account}:halfbvg-art-assets/where-is-art-private/ai-search/quota/*`] }] })]);
  }
  const attachments = cli('ram', 'ListPoliciesForRole', ['--RoleName', roleName]);
  if (!attachments.Policies?.Policy?.some(p => p.PolicyName === policyName)) cli('ram', 'AttachPolicyToRole', ['--RoleName', roleName, '--PolicyType', 'Custom', '--PolicyName', policyName]);
  console.log('Quota role ready (only GetObject/PutObject in the private quota prefix)');
  const functions = cli('fc', 'ListFunctions', ['--prefix', name, '--limit', '100']);
  const exists = functions.functions?.some(f => f.functionName === name);
  const previous = exists ? cli('fc', 'GetFunction', ['--functionName', name]) : {};
  const zip = join(directory, 'function.zip');
  execFileSync('zip', ['-qr', zip, 'index.mjs', 'search.mjs', 'quota.mjs', 'package.json', 'package-lock.json', 'node_modules'], { cwd: resolve('server/ai-search'), stdio: 'pipe' });
  const config = {
    description: 'Natural-language search of the published Where Is Art catalog; persistent daily AI quota.',
    runtime: 'nodejs20', handler: 'index.handler', memorySize: 256, cpu: 0.25, timeout: 30, diskSize: 512, internetAccess: true, instanceConcurrency: 5,
    role: role.Arn,
    code: { zipFile: readFileSync(zip).toString('base64') },
    environmentVariables: { DEEPSEEK_API_KEY: key, QUOTA_BUCKET: 'halfbvg-art-assets', QUOTA_HASH_SECRET: previous.environmentVariables?.QUOTA_HASH_SECRET || randomBytes(32).toString('hex'), AI_DAILY_LIMIT: '100', AI_IP_DAILY_LIMIT: '20', ALLOWED_ORIGINS: 'https://anonbug.github.io,http://127.0.0.1:8775,http://localhost:8775' },
  };
  const deployed = cli('fc', exists ? 'UpdateFunction' : 'CreateFunction', exists ? ['--functionName', name] : [], { ...config, ...(!exists ? { functionName: name } : {}) });
  console.log(`Function deployed: ${deployed.functionName} (${region})`);
  cli('fc', 'PutConcurrencyConfig', ['--functionName', name], { reservedConcurrency: 2 });
  let trigger;
  try { trigger = cli('fc', 'GetTrigger', ['--functionName', name, '--triggerName', 'public-http']); }
  catch (error) {
    if (error.code !== 'TriggerNotFound') throw error;
    trigger = cli('fc', 'CreateTrigger', ['--functionName', name], { triggerName: 'public-http', triggerType: 'http', qualifier: 'LATEST', triggerConfig: JSON.stringify({ authType: 'anonymous', methods: ['GET', 'POST', 'OPTIONS'] }) });
  }
  const url = trigger.httpTrigger?.urlInternet;
  if (!url) throw new Error('HTTP trigger URL missing');
  console.log(`Search endpoint: ${url.replace(/\/$/, '')}/api/ai-search`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { key = undefined; rmSync(directory, { recursive: true, force: true }); }
