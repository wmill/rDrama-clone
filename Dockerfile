# --- base: enable pnpm, add native build tools for bcrypt ---
FROM node:22-alpine AS base
RUN corepack enable pnpm
RUN apk add --no-cache python3 make g++

# --- deps: install dependencies from lockfile ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build: compile the production bundle ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- production: minimal runtime image ---
FROM node:22-alpine AS production
RUN corepack enable pnpm
WORKDIR /app

COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/instrument.server.mjs ./instrument.server.mjs

# Install production deps only (needed for drizzle-kit migrate at runtime)
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000
CMD ["node", "--import", "./.output/server/instrument.server.mjs", ".output/server/index.mjs"]

# --- development: full source with hot reload ---
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
