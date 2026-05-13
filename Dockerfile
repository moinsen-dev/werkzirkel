# ───────────────────────────────────────────────────────────────────────────
# Werkzirkel — Multi-Stage Dockerfile
#
# Stage 1 (deps):   Dependencies frisch installieren (pnpm fetch + install)
# Stage 2 (build):  Next.js Build mit `output: 'standalone'` produzieren
# Stage 3 (runner): minimaler Runtime-Container, nicht-root
#
# Build:  docker build -t werkzirkel:latest .
# Run:    docker run -p 3000:3000 --env-file .env werkzirkel:latest
# ───────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-alpine

# ───── Stage 1: Dependencies ─────
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
WORKDIR /app

# Workspace-Layout exakt nachbilden, damit pnpm install zufrieden ist
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/

# Frozen Install, nur Production + Build-Deps
RUN pnpm install --frozen-lockfile

# ───── Stage 2: Build ─────
FROM node:${NODE_VERSION} AS build
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Workspace + Node-Modules aus deps-Stage
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./apps/web
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Build erzeugt .next/standalone (Node-Runtime-Bundle)
RUN pnpm --filter @werkzirkel/web build

# ───── Stage 3: Runtime ─────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root User für reduzierte Angriffsfläche
RUN addgroup -g 1001 -S nodejs && adduser -S werkzirkel -u 1001 -G nodejs

# Standalone-Output von Next enthält Server + minimale node_modules
COPY --from=build --chown=werkzirkel:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=werkzirkel:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=werkzirkel:nodejs /app/apps/web/public ./apps/web/public

USER werkzirkel
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
