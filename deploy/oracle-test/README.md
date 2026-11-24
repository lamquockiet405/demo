# Oracle Always Free test deployment

This deployment restores the supplied full KidMeal snapshot (66 tables with
sample records) at a stable `*.duckdns.org` address. SMTP and VNPAY credentials
are disabled. PostgreSQL, Redis, MinIO, and the backend do not publish ports;
Caddy publishes only HTTP and HTTPS and requires a separate site password.
The SQL dump is kept outside Git because it contains account and child records.

## 1. Create the free resources

1. [Create an Oracle Cloud Free Tier account](https://www.oracle.com/cloud/free/)
   (Oracle requires a payment card for identity verification), then create an
   **Always Free** Ampere A1 VM in the account's home
   region. Choose Ubuntu, 2 OCPUs and up to 12 GB RAM, and stay within the
   Always Free storage allocation. Keep the SSH key used at creation.
2. In the Oracle network security list or network security group, allow inbound
   TCP 80 and 443. Allow SSH (TCP 22) only from your own IP. On the VM firewall,
   allow TCP 80 and 443 as well. Do not expose 3000, 5432, 6379, 9000, or 9001.
3. Register a free subdomain at [DuckDNS](https://www.duckdns.org/). The VM
   will update its address automatically every five minutes.
4. Install Docker Engine and its Compose plugin using the [official Ubuntu
   instructions](https://docs.docker.com/engine/install/ubuntu/). Install Node.js
   (`sudo apt update && sudo apt install -y nodejs`) for the configuration
   scripts, then clone this repository to the VM. Docker images are built on
   the VM, including for Arm.

Oracle may have no Always Free VM capacity in the chosen region. An idle VM may
also be reclaimed. A stable URL does not guarantee uptime.

## 2. Configure

From the repository root on the VM:

```sh
node deploy/oracle-test/prepare.cjs
nano .oracle-test/deploy.env
```

Set `PUBLIC_HOSTNAME` to your full DuckDNS address, `DUCKDNS_SUBDOMAIN` to the
part before `.duckdns.org`, and `DUCKDNS_TOKEN` to the DuckDNS token. Keep the
generated secrets. Do not commit or share `deploy.env`.
The prepare script also saves the site's Basic Auth username and password in
`.oracle-test/access.txt`. Share those credentials only with intended testers.

Copy the local `kidmeal_full_utf8.sql` file to `.oracle-test/full.sql` on the VM
before running the check script. The dump is ignored by Git, so cloning the
repository does not transfer it. On your local computer, with the repository
as the current directory, run (replace the address and SSH key path):

```sh
scp -i PATH_TO_SSH_KEY kidmeal_full_utf8.sql ubuntu@VM_PUBLIC_IP:~/Kidmeal/.oracle-test/full.sql
```

The prepare script copies the dump automatically when it is present at the
repository root on the same machine. The check script requires exactly 66
`CREATE TABLE` and 66 `COPY` blocks before deployment proceeds.

```sh
node deploy/oracle-test/check.cjs
```

Example values (use your own name and token):

```dotenv
PUBLIC_HOSTNAME=kidmeal-test.duckdns.org
DUCKDNS_SUBDOMAIN=kidmeal-test
DUCKDNS_TOKEN=your-private-token
```

## 3. Start and verify

```sh
docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml up -d duckdns
docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml logs --tail 30 duckdns
docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml up -d --build --wait
docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml ps
docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml exec -T postgres psql -U kidmeal_test -d kidmeal_test -Atc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
```

The table count should be **66**. The supplied dump has **14,270 rows** across
those tables, including 132 users and 120 students. A fresh PostgreSQL volume
restores the dump automatically. An existing volume is left untouched, so
replacing `full.sql` does not overwrite a running database.

DuckDNS DNS propagation can take a few minutes. Caddy automatically obtains
and renews an HTTPS certificate once the hostname resolves to the VM and port
80/443 is reachable. Verify the homepage and `https://<hostname>/api/v1/auth/tenants`
from another network. Check Caddy logs if HTTPS does not become available:

```sh
docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml logs --tail 100 web
```

## Operations

Use `docker compose --env-file .oracle-test/deploy.env -f compose.oracle-test.yml`
before the commands below:

- `logs --tail 100 backend` to inspect application errors.
- `up -d --build --wait` after pulling updates.
- `down` to stop while retaining volumes.

Back up the PostgreSQL and MinIO volumes regularly. `down -v` deletes all test
data. The full dump already includes names and account records; review whether
those records may be published to a publicly reachable test instance.
Before deploying a production version, replace any credentials that have ever
been committed to the repository and review public authentication endpoints.
