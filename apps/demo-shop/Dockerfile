FROM node:22-alpine AS deps
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/demo-shop/package.json apps/demo-shop/package.json
RUN pnpm install --frozen-lockfile --filter @releasetruth/truthshop...

FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/demo-shop/node_modules ./apps/demo-shop/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/demo-shop ./apps/demo-shop
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @releasetruth/truthshop build

FROM node:22-alpine
WORKDIR /workspace
RUN corepack enable
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /workspace ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@releasetruth/truthshop", "start"]
