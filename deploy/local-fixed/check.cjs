const fs = require('node:fs');
const path = require('node:path');

const envPath = path.resolve(__dirname, '..', '..', '.local-fixed', 'deploy.env');
if (!fs.existsSync(envPath)) throw new Error('Run node deploy/local-fixed/prepare.cjs first.');
const vars = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));

const subdomain = vars.DUCKDNS_SUBDOMAIN;
if (!subdomain || subdomain === 'replace-me' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(subdomain)) {
  throw new Error('Set DUCKDNS_SUBDOMAIN to your registered DuckDNS name.');
}
if (vars.PUBLIC_HOSTNAME !== `${subdomain}.duckdns.org`) {
  throw new Error('PUBLIC_HOSTNAME must equal DUCKDNS_SUBDOMAIN + .duckdns.org.');
}
if (!vars.DUCKDNS_TOKEN || vars.DUCKDNS_TOKEN === 'replace-me') {
  throw new Error('Set DUCKDNS_TOKEN from your DuckDNS account.');
}
const ip = vars.DUCKDNS_IPV4;
const octets = (ip || '').split('.').map(Number);
if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255) ||
    octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224 ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)) {
  throw new Error('Set DUCKDNS_IPV4 to the public WAN IPv4 shown on the router, not a local or CGNAT address.');
}
if (!/^'?\$2[aby]\$/.test(vars.DEMO_PASSWORD_HASH || '')) {
  throw new Error('Run prepare.cjs to generate the site password hash.');
}
console.log(`Local fixed-link configuration ready for https://${vars.PUBLIC_HOSTNAME}`);
