# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /workspace
COPY package.json yarn.lock nx.json tsconfig.base.json tailwind.config.js postcss.config.js ./
COPY apps ./apps
COPY libs ./libs
RUN yarn install --frozen-lockfile
RUN yarn nx build web --configuration=production --skip-nx-cache

FROM nginx:alpine AS runtime
COPY --from=builder /workspace/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
