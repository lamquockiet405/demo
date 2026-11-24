const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const output = path.join(root, '.oracle-test');
const envPath = path.join(output, 'deploy.env');
fs.mkdirSync(output, { recursive: true });

const sourceDump = path.join(root, 'kidmeal_full_utf8.sql');
const localDump = path.join(output, 'full.sql');
if (!fs.existsSync(localDump) && fs.existsSync(sourceDump)) {
  fs.copyFileSync(sourceDump, localDump);
  console.log(`Copied full database dump to ${localDump}`);
}

if (fs.existsSync(envPath)) {
  console.log(`Existing configuration kept: ${envPath}`);
} else {
  const keys = [
    'TEST_POSTGRES_PASSWORD',
    'TEST_REDIS_PASSWORD',
    'TEST_MINIO_PASSWORD',
    'TEST_JWT_SECRET',
    'TEST_JWT_REFRESH_SECRET',
  ];
  const lines = [
    '# Replace these three values before starting the public test deployment.',
    'PUBLIC_HOSTNAME=replace-me.duckdns.org',
    'DUCKDNS_SUBDOMAIN=replace-me',
    'DUCKDNS_TOKEN=replace-me',
    ...keys.map((key) => `${key}=${crypto.randomBytes(32).toString('hex')}`),
  ];
  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { mode: 0o600, flag: 'wx' });
  console.log(`Created ${envPath}`);
}

if (!fs.readFileSync(envPath, 'utf8').includes('DEMO_PASSWORD_HASH=')) {
  const password = crypto.randomBytes(24).toString('base64url');
  const result = spawnSync('docker', ['run', '-i', '--rm', 'caddy:2-alpine', 'caddy', 'hash-password'], {
    input: `${password}\n`,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Could not hash access password: ${result.stderr}`);
  const hash = result.stdout.trim();
  if (!/^\$2[aby]\$/.test(hash)) throw new Error('Unexpected Caddy password hash.');
  fs.appendFileSync(envPath, `DEMO_PASSWORD_HASH='${hash}'\n`);
  const accessPath = path.join(output, 'access.txt');
  fs.writeFileSync(accessPath, `Username: demo\nPassword: ${password}\n`, { mode: 0o600, flag: 'wx' });
  console.log(`Created private site access credentials at ${accessPath}`);
}
