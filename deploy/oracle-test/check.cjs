const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(__dirname, '..', '..', '.oracle-test');
const envPath = path.join(output, 'deploy.env');
if (!fs.existsSync(envPath)) {
  console.error('Run node deploy/oracle-test/prepare.cjs first.');
  process.exit(1);
}

const dumpPath = path.join(output, 'full.sql');
if (!fs.existsSync(dumpPath)) {
  console.error('Place kidmeal_full_utf8.sql at .oracle-test/full.sql first.');
  process.exit(1);
}
const dump = fs.readFileSync(dumpPath, 'utf8');
const tableCount = (dump.match(/^CREATE TABLE public\./gm) || []).length;
const dataBlockCount = (dump.match(/^COPY public\./gm) || []).length;
if (tableCount !== 66 || dataBlockCount !== 66) {
  console.error(`Expected 66 tables and 66 data blocks; found ${tableCount} and ${dataBlockCount}.`);
  process.exit(1);
}

const vars = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const name = vars.DUCKDNS_SUBDOMAIN;
if (!name || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) {
  console.error('Set DUCKDNS_SUBDOMAIN to a valid DuckDNS subdomain.');
  process.exit(1);
}
if (vars.PUBLIC_HOSTNAME !== `${name}.duckdns.org`) {
  console.error('PUBLIC_HOSTNAME must match DUCKDNS_SUBDOMAIN + .duckdns.org.');
  process.exit(1);
}
if (!vars.DUCKDNS_TOKEN || vars.DUCKDNS_TOKEN === 'replace-me') {
  console.error('Set DUCKDNS_TOKEN in .oracle-test/deploy.env.');
  process.exit(1);
}
if (!/^'?\$2[aby]\$/.test(vars.DEMO_PASSWORD_HASH || '')) {
  console.error('Run the prepare script to generate the site access password.');
  process.exit(1);
}
for (const key of [
  'TEST_POSTGRES_PASSWORD',
  'TEST_REDIS_PASSWORD',
  'TEST_MINIO_PASSWORD',
  'TEST_JWT_SECRET',
  'TEST_JWT_REFRESH_SECRET',
]) {
  if (!vars[key] || vars[key].length < 32) {
    console.error(`Missing or short ${key}.`);
    process.exit(1);
  }
}
console.log(`Configuration is ready for https://${vars.PUBLIC_HOSTNAME} with ${tableCount} tables.`);
