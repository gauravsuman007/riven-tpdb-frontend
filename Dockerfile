# Frontend Builder
FROM node:24-alpine AS frontend
WORKDIR /app

# Manifests FIRST, so the install layer is keyed on the lockfile rather than
# on the source tree.
#
# This was `COPY . .` before the install, which made every commit -- a
# one-line change to a Svelte component included -- invalidate the copy layer
# and therefore the install below it. Measured on CI: exactly one layer was
# ever a cache hit, and `pnpm install` re-ran on every single build at 65-72s
# per architecture, roughly half the total build time, to produce a
# node_modules identical to the previous run's.
#
# `prepare` (svelte-kit sync) runs during install without the source present,
# which is why it is written to tolerate failure in package.json; the real
# sync happens as part of `vite build` below, after the source is copied.
COPY package.json pnpm-lock.yaml .npmrc ./

# Activate the pnpm version pinned in package.json's packageManager field.
# `npm install -g pnpm` installs a different build, and pnpm 10 then tries to
# self-manage by fetching @pnpm/exe, which fails on arm64 because the lockfile
# has no entry for that platform.
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate && pnpm install --frozen-lockfile

COPY . .
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
