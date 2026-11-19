FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --global npm@11.19.0 && npm ci

FROM dependencies AS migrator
ENV NODE_ENV=production
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
USER node
CMD ["npm", "run", "db:migrate"]

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health/live >/dev/null || exit 1
CMD ["node", "server.js"]
