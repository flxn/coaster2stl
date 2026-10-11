# coaster2stl: the site and its gallery API in one Node process.
# Coolify: "Dockerfile" build pack, port 3000, and a persistent volume mounted at /data (the SQLite database).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
# Node runs the TypeScript server directly (type stripping); node:sqlite still prints an experimental warning
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
