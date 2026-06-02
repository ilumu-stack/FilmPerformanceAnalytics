FROM node:20-alpine AS base

# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json .npmrc* ./
# Copy lockfile if it exists (optional — .npmrc handles missing lockfile gracefully)
COPY package-lock.json* ./

# --legacy-peer-deps avoids hard failures from peer dep version mismatches
# (e.g. eslint-config-next@14 requires eslint@^8, not ^9)
RUN npm install --legacy-peer-deps

# ── Stage 2: Build the Next.js app ──────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_ vars are baked at build time for client-side code.
# BACKEND_URL is set at runtime via docker-compose environment: — not needed here.
ARG NEXT_PUBLIC_ANTHROPIC_MODEL=claude-sonnet-4-20250514
ENV NEXT_PUBLIC_ANTHROPIC_MODEL=$NEXT_PUBLIC_ANTHROPIC_MODEL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Minimal production runner ──────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy the standalone output (includes only what Next.js needs to run)
COPY --from=builder /app/public                          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
