# ---- Build stage ----------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app

# Install with the lockfile so builds are reproducible.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build the client bundle and the server bundle.
COPY . .
RUN npm run build

# Drop dev dependencies from node_modules for the runtime image.
RUN npm prune --omit=dev


# ---- Runtime stage --------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Cloud Run overrides this at runtime; the server reads process.env.PORT.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
