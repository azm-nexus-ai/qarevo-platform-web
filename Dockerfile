# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.33.4

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

RUN pnpm build

# ==========================================
# STAGE 2: Runner
# ==========================================
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@10.33.4

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["pnpm", "start"]