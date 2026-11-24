const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const output = path.join(root, '.local-fixed');
const envPath = path.join(output, 'deploy.env');
const accessPath = path.join(output, 'access.txt');
fs.mkdirSync(output, { recursive: true });

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, [
    '# Replace the first three values with your DuckDNS details.',
    'PUBLIC_HOSTNAME=replace-me.duckdns.org',
    'DUCKDNS_SUBDOMAIN=replace-me',
    'DUCKDNS_TOKEN=replace-me',
    'DUCKDNS_IPV4=replace-me',
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
}

if (!fs.readFileSync(envPath, 'utf8').includes('DEMO_PASSWORD_HASH=')) {
  const password = crypto.randomBytes(24).toString('base64url');
  const result = spawnSync('docker', ['run', '-i', '--rm', 'caddy:2-alpine', 'caddy', 'hash-password'], {
    input: `${password}\n`,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Could not hash demo password: ${result.stderr}`);
  const hash = result.stdout.trim();
  if (!/^\$2[aby]\$/.test(hash)) throw new Error('Unexpected Caddy password hash.');
  fs.appendFileSync(envPath, `DEMO_PASSWORD_HASH='${hash}'\n`);
  fs.writeFileSync(accessPath, `Username: demo\nPassword: ${password}\n`, { flag: 'wx', mode: 0o600 });
}

console.log(`Edit ${envPath} with your DuckDNS subdomain and token.`);
console.log(`Private site login is in ${accessPath}.`);
