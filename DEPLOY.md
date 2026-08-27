# Deploying AgencyOS to your VPS

The app runs as two separate containers — `api` and `web` — built from the Dockerfiles in
`apps/api/` and `apps/web/`. Local dev (`npm run dev`) is completely unaffected by any of this.

## Architecture

- **`api`** — Node/Express, listens internally on port **4820** (chosen to avoid the common
  3000/8000 ranges, since you already have something on 3100). Not exposed publicly by default.
- **`web`** — the built React app served by nginx, which also reverse-proxies `/api/*` to the
  `api` container over Docker's internal network. This is the only container your VPS's existing
  reverse proxy needs to point a domain at.
- **Database & storage** — unchanged: your already-configured Supabase Postgres + Storage
  (`apps/api/.env`). `docker-compose.yml` (local Postgres/MinIO) is for local dev only and isn't
  part of this production setup.

## One-time setup

1. Make sure `apps/api/.env` has real production values, in particular:
   - `APP_URL` — your real public domain (e.g. `https://app.suaagencia.com`), not
     `http://localhost:5173`. This drives CORS and every generated link (approval portal, public
     reports, Meta OAuth redirect).
   - `API_URL` — only matters if `STORAGE_TYPE=local`; leave as-is if you're on S3/Supabase
     Storage (already the case per your current `.env`).
   - `DATABASE_URL`, `OPENAI_API_KEY`, `ENCRYPTION_KEY`, `JWT_SECRET`, etc. — already set.
2. Point your VPS's reverse proxy (nginx/Traefik/Caddy/whatever you already run) at the `web`
   container's published port for your domain, with TLS handled there as usual — this compose
   file doesn't do TLS itself.

## Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Neither container publishes a port to the host — both use `expose` (internal-only, reachable
over the compose network by service name: `api:4820`, `web:80`). Point your reverse proxy at
whatever mechanism you use to reach containers on the Docker network (a shared proxy network,
Traefik labels, etc.) — see the Coolify section below for how that platform handles it
automatically. If you want a direct host-published port for manual debugging, add a temporary
`ports:` entry to the relevant service.

## Updating after a code change

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Rebuilds both images and restarts with zero manual steps. Database migrations are **not** run
automatically by the container (deliberately — they touch your real data) — run them yourself
before deploying a release that needs one:

```bash
npm run db:migrate --workspace=apps/api   # or: npx prisma migrate deploy (from apps/api)
```

## Logs / status

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml ps
```

## Deploying via Coolify

Coolify can't discover a bare `Dockerfile` here because the repo has two of
them (one per app) — it needs to be told this is a **Docker Compose**
deployment, pointed at the right compose file, explicitly:

1. **New Resource → Docker Compose** (not "Dockerfile" / "Application" — those
   resource types expect exactly one Dockerfile at the repo root, which this
   repo doesn't have).
2. Connect the repository and branch as usual.
3. Set **"Docker Compose Location"** (sometimes labeled "Base Directory" +
   "Compose File") to `docker-compose.prod.yml` — Coolify defaults to
   `docker-compose.yml`, which is the local-dev Postgres/MinIO stack and has
   no `build:`/Dockerfile references at all, which is why it looked
   unreachable.
4. In the resource's **Environment Variables** panel, add every key
   referenced under `services.api.environment` in `docker-compose.prod.yml`
   (`APP_URL`, `API_URL`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
   `OPENAI_API_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`,
   `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL`,
   `META_REDIRECT_URI`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`,
   `ENCRYPTION_KEY`, plus optionally `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`,
   `AI_MODEL`, `STORAGE_TYPE`, `STORAGE_LOCAL_PATH`, `META_GRAPH_VERSION`
   if you want non-default values) with the same
   values as your `apps/api/.env` — Coolify injects these directly into the
   compose build/up, it does **not** read `apps/api/.env` from the repo
   (that file is gitignored and never gets cloned).
5. Domain: nothing to do manually — `docker-compose.prod.yml` declares
   Coolify's magic `SERVICE_FQDN_WEB` env var on the `web` service, so
   Coolify auto-generates a domain and wires up its Traefik proxy to it on
   deploy, the same as its other one-click apps. If you want a custom
   domain instead of the auto-generated one, set it in the resource's
   Access/Domains tab after the first successful deploy. `api` has no
   domain and isn't reachable publicly — it's only ever called internally
   over the compose network via `web`'s nginx.
6. Deploy. Coolify will build both Dockerfiles and start both containers;
   the `web` service waits on `api`'s healthcheck before starting. Neither
   service publishes a host port (both use `expose`), so Coolify's Traefik
   proxy reaches `web` over the internal network once you set its domain —
   this also means a stuck/orphaned container from a previous failed deploy
   can never block a new one with a "port already allocated" error.

After the first deploy, run migrations once (Coolify's terminal/exec tab on
the `api` container, or via SSH):

```bash
npx prisma migrate deploy   # from inside the api container's /app dir
```
