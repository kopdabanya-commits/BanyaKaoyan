import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean);
const forbiddenPaths = [
  /(?:^|\/)\.env(?:\.|$)/i,
  /(?:^|\/)(?:id_rsa|id_ed25519)(?:\.|$)/i,
  /\.(?:pem|key|sqlite|sqlite3|db)(?:-|$)/i,
  /\.(?:zip|csv|xlsx|pdf)$/i,
  /(?:^|\/)[^/]*backup[^/]*\.(?:json|zip)$/i,
];
const forbiddenContent = [
  ['private key', /-----BEGIN (?:OPENSSH|RSA|EC|DSA|ENCRYPTED)? ?PRIVATE KEY-----/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['private plan access key', /banya_plan_[A-Za-z0-9_-]{40,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['hardcoded deployment credential', /(?:BANYA_ECS_SSH_PASSWORD|BANYA_SYNC_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*['"]?(?!configured\b|available\b|missing\b)[A-Za-z0-9+/=_-]{8,}/],
  ['personal phone number', /(?<!\d)1[3-9]\d{9}(?!\d)/],
];
const violations = [];
for (const file of files) {
  if (file.endsWith('.json') && !['plan.json', 'politics-plan.json', 'server/banya-sync/agent-openapi.json'].includes(file)) {
    violations.push(`${file}: unapproved JSON file (may contain a learning backup)`);
    continue;
  }
  if (forbiddenPaths.some((pattern) => pattern.test(file))) {
    violations.push(`${file}: private file path`);
    continue;
  }
  const bytes = fs.readFileSync(file);
  if (bytes.includes(0)) continue;
  for (const [label, pattern] of forbiddenContent) {
    if (pattern.test(bytes.toString('utf8'))) violations.push(`${file}: ${label}`);
  }
}
if (violations.length) {
  console.error('Privacy check blocked tracked material (values are intentionally hidden):');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Privacy check passed for ${files.length} tracked files.`);
}
