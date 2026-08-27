# Build context is the REPO ROOT (not apps/api) — this is an npm-workspaces monorepo, and
# Prisma's generated client + hoisted deps live in the root node_modules, not a per-app one.
# Build with:  docker build -f apps/api/Dockerfile -t agencyos-api .   (from the repo root)
# docker-compose.prod.yml already points at this file with the right context.

FROM node:20-bookworm-slim AS builder
RUN apt-get update -qq && apt-get install -y -qq openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
# No package-lock.json here, deliberately — it was resolved on Windows, and could pin sharp's
# Windows-specific optional native binary the same way it did rollup's in the web build (npm
# bug npm/cli#4828 — even `npm install`, not just `ci`, won't re-resolve it with the lockfile
# present). A lockfile-free install correctly picks the linux-x64 binary for this container.
RUN npm install

COPY apps/api apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
RUN apt-get update -qq && apt-get install -y -qq openssl && rm -rf /var/lib/apt/lists/* \
  && groupadd -r agencyos && useradd -r -g agencyos agencyos

WORKDIR /repo
ENV NODE_ENV=production

# Full root node_modules (not a hand-pruned subset) — npm workspaces hoists everything here;
# apps/api has no node_modules of its own (confirmed while building this image — there's nothing
# to copy from there). The Prisma client specifically must resolve from this exact root path.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/prisma ./apps/api/prisma
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json

USER agencyos
WORKDIR /repo/apps/api
EXPOSE 4820
CMD ["node", "dist/index.js"]
