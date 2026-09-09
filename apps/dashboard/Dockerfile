FROM node:22-alpine AS deps
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN pnpm install --frozen-lockfile --filter @releasetruth/dashboard...

FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/dashboard ./apps/dashboard
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @releasetruth/dashboard build

FROM node:22-alpine
WORKDIR /workspace
RUN corepack enable
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 RELEASETRUTH_API_URL=http://api:8000
COPY --from=build /workspace ./
EXPOSE 3002
CMD ["pnpm", "--filter", "@releasetruth/dashboard", "start"]
