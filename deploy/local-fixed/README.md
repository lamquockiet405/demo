# Fixed free URL for the local Docker demo

This keeps the existing `kidmeal-test` Docker stack on this computer. DuckDNS
provides a stable `*.duckdns.org` hostname; Caddy serves HTTPS and requires a
separate demo password before proxying to the frontend. The frontend already
proxies `/api` and `/socket.io` to the backend. No Cloudflare Quick Tunnel is
used.

## Requirements

- The computer and Docker Desktop must stay on for the site to be available.
- The home router must have a public IPv4 address, and you must be able to
  forward inbound TCP 80 and 443 to this computer. If the ISP uses CGNAT,
  ordinary port forwarding will not work. Compare the router's WAN IPv4 with
  the public IPv4 shown by an external IP-check site; if they differ, ask the
  ISP for public IPv4 or use a hosted service instead.
- Windows firewall must allow inbound TCP 80 and 443 to Docker/Caddy.
- Register a free DuckDNS subdomain at https://www.duckdns.org/ and copy its
  token. Treat the token like a password.

## Configure

From the repository root in PowerShell:

```powershell
node deploy/local-fixed/prepare.cjs
notepad .local-fixed/deploy.env
```

Replace the placeholders, including `DUCKDNS_IPV4` with the public WAN IPv4
shown on the router's Status page. This machine currently uses Cloudflare WARP,
so automatic IP detection would publish WARP's IP instead of the router's.
For example, if DuckDNS gives
you `kidmeal-example.duckdns.org`, use:

```dotenv
PUBLIC_HOSTNAME=kidmeal-example.duckdns.org
DUCKDNS_SUBDOMAIN=kidmeal-example
DUCKDNS_TOKEN=your-private-duckdns-token
DUCKDNS_IPV4=your-router-public-wan-ipv4
```

Keep the generated `DEMO_PASSWORD_HASH` line. The private site username and
password are in `.local-fixed/access.txt`. Both private files are ignored by
Git. Before startup, check the configuration:

```powershell
node deploy/local-fixed/check.cjs
```

## Router and startup

In the router's Port Forwarding settings, forward external **TCP 80** to this
computer's internal IPv4 port 80, and external **TCP 443** to internal port 443.
Reserve this computer's local IPv4 address in the router so it does not change.
Do not forward PostgreSQL, Redis, MinIO, or backend ports.

The existing `compose.test.yml` stack must be running first. Then run:

```powershell
docker compose --env-file .local-fixed/deploy.env -f compose.local-fixed.yml up -d
docker compose --env-file .local-fixed/deploy.env -f compose.local-fixed.yml logs --tail 30 duckdns web
```

DuckDNS should log no update errors. Caddy needs public DNS and reachable port
80 or 443 to obtain an HTTPS certificate. Test
`https://<your-subdomain>.duckdns.org` from a phone with Wi-Fi off. The browser
will ask for the separate demo login. The address stays the same. If your
public WAN IP changes, update `DUCKDNS_IPV4` and restart the `duckdns` service. The site
still goes offline when the computer, Docker Desktop, or home internet is off.

If the router has no public IPv4, the free hosted Docker option in
`deploy/render/README.md` provides a fixed `*.onrender.com` address instead,
but Render Free sleeps when idle.
