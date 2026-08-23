# Frontend Builder
FROM node:24-alpine AS frontend
WORKDIR /app
COPY . .
# Activate the pnpm version pinned in package.json's packageManager field.
# `npm install -g pnpm` installs a different build, and pnpm 10 then tries to
# self-manage by fetching @pnpm/exe, which fails on arm64 because the lockfile
# has no entry for that platform.
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate && pnpm install --frozen-lockfile
# Vite's SSR bundle exceeds node's default old-space limit on this project,
# aborting with a heap OOM (exit 134). Raise it for the build only.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN pnpm run build && pnpm prune --prod

# Final Image
FROM node:24-alpine
LABEL name="Riven" \
    description="Riven Media Server: Frontend" \
    url="https://github.com/rivenmedia/riven-frontend"

# Set working directory
WORKDIR /riven

# Copy frontend build from the previous stage
COPY --from=frontend  /app/build /riven/build
COPY --from=frontend  /app/node_modules /riven/node_modules
COPY --from=frontend  /app/package.json /riven/package.json
COPY drizzle /riven/drizzle

# Add the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "/riven/build"]
