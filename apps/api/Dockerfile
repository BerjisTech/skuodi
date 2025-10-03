# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /workspace
COPY package.json yarn.lock nx.json tsconfig.base.json ./
COPY libs ./libs
COPY apps/api ./apps/api
RUN yarn install --frozen-lockfile
RUN yarn nx build api --skip-nx-cache

FROM node:22-alpine AS runtime
WORKDIR /workspace
COPY --from=base /workspace/dist/apps/api ./dist
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile
ENV NODE_ENV=production
ENV PORT=3001
CMD ["node", "dist/main.js"]
