# Build context is the REPO ROOT — same npm-workspaces reasoning as apps/api/Dockerfile.
# Build with:  docker build -f apps/web/Dockerfile -t agencyos-web .   (from the repo root)

FROM node:20-bookworm-slim AS builder
WORKDIR /repo

COPY package.json ./
COPY apps/web/package.json apps/web/package.json
# No package-lock.json here, deliberately — it was resolved on Windows, and it pins rollup's
# Windows-specific optional native binary. npm/cli#4828 means even `npm install` (not `ci`) with
# that lockfile present won't re-resolve it; only a lockfile-free install correctly picks
# @rollup/rollup-linux-x64-gnu for this container's actual platform.
RUN npm install

COPY apps/web apps/web
RUN npm run build --workspace=apps/web

# ─── Runtime — static files served by nginx, /api proxied to the api container ──────────────
FROM nginx:1.27-alpine AS runtime
COPY apps/web/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
