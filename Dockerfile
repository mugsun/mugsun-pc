# syntax=docker/dockerfile:1.7
# ============================================================
# mugsun-pc 生产镜像（多阶段：node 构建 → nginx:alpine 托管）
#
# 依赖 @mugsun/track-web 在 package.json 中是 file:../mugsun-track，
# 镜像里通过「命名构建上下文 track」提供，不需要把父目录整个当 context：
#
#   docker build --build-context track=../mugsun-track -t mugsun/pc:local .
#
# compose 中对应 additional_contexts（见 docker/compose.pc.yml）。
# ============================================================

# ---------- 阶段 1：构建 ----------
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@11.28.2 --activate
WORKDIR /src

# 1) 埋点 SDK（只拷源码，不带宿主机的 node_modules / dist）
COPY --from=track package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsup.config.ts mugsun-track/
COPY --from=track scripts mugsun-track/scripts
COPY --from=track src mugsun-track/src
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    cd mugsun-track && pnpm install --frozen-lockfile && pnpm build

# 2) 管理台依赖（先只拷清单，充分利用层缓存）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml mugsun-pc/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    cd mugsun-pc && pnpm install --frozen-lockfile --ignore-scripts

# 3) 源码构建。VITE_API_URL 默认 /（同源，经本镜像 nginx 的 /api 反代到后端），
#    后端地址在运行时由 MUGSUN_API_UPSTREAM 决定，无需为不同环境重新构建。
COPY . mugsun-pc/
ARG VITE_API_URL=/
ARG VITE_BASE_URL=/
ENV VITE_API_URL=$VITE_API_URL VITE_BASE_URL=$VITE_BASE_URL
ARG NODE_MAX_OLD_SPACE=6144
RUN cd mugsun-pc && NODE_OPTIONS=--max-old-space-size=$NODE_MAX_OLD_SPACE pnpm exec vite build

# ---------- 阶段 2：运行时 ----------
FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="mugsun-pc" \
      org.opencontainers.image.description="Mugsun 管理台前端（nginx 托管）" \
      org.opencontainers.image.source="https://github.com/mugsun/mugsun-pc"

# 后端地址（不带 /api，nginx 会去掉 /api 前缀再转发，与 vite dev 代理行为一致）
ENV MUGSUN_API_UPSTREAM=http://mugsun-boot:8080 \
    NGINX_ENVSUBST_FILTER=^MUGSUN_

RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /src/mugsun-pc/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
