# Build context MUST be the repo root (pnpm needs the whole workspace to
# resolve the lockfile), not this directory:
#   docker build -f apps/api/Dockerfile -t aircatch-api .
#
# Follows pnpm's own recommended monorepo deploy pattern
# (https://pnpm.io/cli/deploy): build once in the full workspace, use
# `pnpm deploy` to extract just @aircatch/api plus its production deps into
# a self-contained folder, then copy only that into a minimal runtime image.

FROM node:20-alpine AS workspace
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aircatch/api build

FROM workspace AS pruned
RUN pnpm --filter @aircatch/api --prod deploy /repo/pruned

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=pruned /repo/pruned .
EXPOSE 3000
CMD ["node", "dist/main.js"]
