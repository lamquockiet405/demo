# KidMeal on Render Free: one Docker service, one URL

This deployment builds the NestJS backend and Vite frontend into one Docker
image. NestJS serves the frontend, REST API and Socket.IO on the same port.
Render supplies one stable `*.onrender.com` service URL. Neon hosts PostgreSQL.
No Vercel service is required.

## 1. Verify Neon

In the Neon console, select the `production` branch and `kidmeal_prod` database.
Open **Connect** and copy the **direct** connection string (pooling off). Keep it
private. Check that the `public` schema already has 66 tables. If it is empty,
run `./import-neon.ps1` in PowerShell from the repository root after copying the
connection string. The script refuses to import into a nonempty database. The
SQL dump has DROP statements and includes account and child records; never
commit it to Git.

## 2. Deploy the Docker image

Push the deployment changes to GitHub. In Render, choose **New + > Blueprint**
and select the repository. The repository's `render.yaml` creates one Free Web
Service named `kidmeal`, builds `deploy/render/Dockerfile`, and generates unique
JWT secrets. Render asks for these Neon fields during initial creation:

| Render variable | Value from Neon |
| --- | --- |
| `POSTGRES_HOST` | Direct hostname |
| `POSTGRES_USER` | Username |
| `POSTGRES_PASSWORD` | Password |

The Blueprint sets `POSTGRES_DB=kidmeal_prod`, `POSTGRES_PORT=5432`, and
`POSTGRES_SSL=true`. Check that the database name in the Neon connection string
really is `kidmeal_prod`; update `render.yaml` if it differs. Use a direct Neon
hostname for the initial SQL import. The backend can use a pooled hostname later
if needed, but test the deployment first.

If you create a Web Service manually instead, choose **Docker**, Free instance,
Dockerfile path `deploy/render/Dockerfile`, build context the repository root,
and add the same variables plus `NODE_ENV=production`, `PORT=10000`,
`POSTGRES_DB=kidmeal_prod`, `POSTGRES_PORT=5432`, `POSTGRES_SSL=true`,
`JWT_SECRET` and `JWT_REFRESH_SECRET` (two distinct random values).

## 3. Check the single URL

When Render reports a successful deploy, open the actual URL from its dashboard.
If the name is available, it will be `https://kidmeal.onrender.com`.
Check the homepage and `/api/v1/auth/tenants` under that same origin. Test login
and the kitchen realtime connection. The URL stays assigned to the service, but
Render Free spins down after 15 minutes of inactivity. The next request can take
about one minute to wake it. The service filesystem is temporary, so uploaded
files need external storage. Render Free also blocks outgoing SMTP ports 25,
465 and 587; password reset email needs another delivery provider.

Never use the old development secrets for public deployment. Review the sample
user and child records before sharing the site URL.
