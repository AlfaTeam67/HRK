FROM git.hrk.pl:3000/pypi-local/node:20-alpine AS builder

WORKDIR /app

ENV npm_config_registry=https://git.hrk.pl:3000/api/packages/pypi-local/npm/

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL build arg is required" && exit 1)
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM git.hrk.pl:3000/pypi-local/node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

USER node

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4173 >/dev/null || exit 1

CMD ["node", "server.js"]
