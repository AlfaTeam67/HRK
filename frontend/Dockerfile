FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL build arg is required" && exit 1)
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g serve@14.2.4

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4173 >/dev/null || exit 1

CMD ["serve", "-s", "dist", "-l", "4173"]
