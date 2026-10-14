# syntax=docker/dockerfile:1.7
# ============================================================
# mugsun-pc 生产镜像（多阶段：node 构建 → nginx-unprivileged 托管，非 root、容器内监听 8080）
#
# 依赖 @mugsun/track-web 在 package.json 中是 file:../mugsun-track，
# 镜像里通过「命名构建上下文 track」提供，不需要把父目录整个当 context：
#
#   docker build --build-context track=../mugsun-track -t mugsun/pc:local .
#
# compose 中对应 additional_contexts（见 docker/compose.pc.yml）。
# ============================================================

# ---------- 阶段 1：构建 ----------
# 基础镜像固定 digest（升级时同步更新 tag 与 digest）
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
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
# 非 root（uid 101）运行，容器内监听 8080；宿主机端口在 compose 里映射
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0
LABEL org.opencontainers.image.title="mugsun-pc" \
      org.opencontainers.image.description="Mugsun 管理台前端（nginx 托管）" \
      org.opencontainers.image.source="https://github.com/mugsun/mugsun-pc"

# 后端地址（不带 /api，nginx 会去掉 /api 前缀再转发，与 vite dev 代理行为一致）
# MUGSUN_GATEWAY_CIDRS：前置网关（TLS 终端/负载均衡）所在网段，逗号或空格分隔；
#   只有来自这些地址的 X-Forwarded-For / X-Forwarded-Proto 才被采信，默认空 = 不信任任何前置代理。
# MUGSUN_CSP_TILE_HOSTS / MUGSUN_CSP_TRACK_HOSTS：CSP 额外放行的地图瓦片域 / 埋点上报域（空格分隔）。
ENV MUGSUN_API_UPSTREAM=http://mugsun-boot:8080 \
    MUGSUN_GATEWAY_CIDRS= \
    MUGSUN_CSP_TILE_HOSTS= \
    MUGSUN_CSP_TRACK_HOSTS= \
    NGINX_ENVSUBST_FILTER=^MUGSUN_

USER root
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.inc.template /etc/nginx/templates/security-headers.inc.template
COPY --chmod=0755 docker/nginx/15-mugsun-gateway.sh /docker-entrypoint.d/15-mugsun-gateway.sh
COPY --from=build /src/mugsun-pc/dist /usr/share/nginx/html
USER 101

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
