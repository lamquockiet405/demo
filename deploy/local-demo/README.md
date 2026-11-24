# Fixed free demo URL from this computer

The full 66-table SQL dump runs in the isolated `kidmeal-oracle-test` Docker
stack. This gateway publishes only `127.0.0.1:5180` and requires the password
in `.oracle-test/access.txt`. Tailscale Funnel can publish that local port at a
stable HTTPS `*.ts.net` URL. The computer and Docker must stay running.

From the repository root:

```powershell
node deploy/oracle-test/prepare.cjs
docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml up -d --build --wait postgres redis minio backend frontend
docker compose --env-file .oracle-test/deploy.env -f compose.local-demo.yml up -d
```

Install Tailscale on this Windows computer and sign in to a Personal account.
Enable Funnel when prompted. In an Administrator PowerShell window, run:

```powershell
tailscale funnel --bg 5180
tailscale funnel status
```

The status output shows the public `https://<device>.<tailnet>.ts.net/` URL.
Visitors need the username/password from `.oracle-test/access.txt`, followed
by an application account. Do not share the access file publicly. The
Tailscale Personal plan is for non-commercial use; Funnel has bandwidth limits.

To stop the public endpoint, run `tailscale funnel off`. To stop the local
gateway, run `docker compose --env-file .oracle-test/deploy.env -f
compose.local-demo.yml down`. The database volume remains intact.
