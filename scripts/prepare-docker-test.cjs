const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.docker-test');
fs.mkdirSync(output, { recursive: true });
const envPath = path.join(output, 'test.env');
if (!fs.existsSync(envPath)) {
  const keys = ['TEST_POSTGRES_PASSWORD', 'TEST_REDIS_PASSWORD', 'TEST_MINIO_PASSWORD', 'TEST_JWT_SECRET', 'TEST_JWT_REFRESH_SECRET'];
  fs.writeFileSync(envPath, keys.map(key => `${key}=${crypto.randomBytes(32).toString('hex')}`).join('\n') + '\n');
}
console.log('Prepared local Docker test environment.');
