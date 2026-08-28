# mugsun-pc

[English](./README_EN.md) | 简体中文

mugsun 的 PC 管理端：Vue 3 + TypeScript + Vite + Element Plus。系统管理、低代码、工作流、监控、开放平台、埋点看板、租户运营等页面都在这里。

[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/) [![Element Plus](https://img.shields.io/badge/Element%20Plus-2.11-409EFF?logo=element&logoColor=white)](https://element-plus.org/) [![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/) [![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

## 功能

- 侧边栏走后端菜单树，改角色授权后刷新即可；`v-perm` / `hasPerm` 做按钮级权限
- `useTable` / `useCrud` / `useDict`，表格列配置可持久化
- form-create 表单设计与运行时渲染
- `@mugsun/track-web` 挂接 pageview、停留、Web Vitals、错误、接口监控、曝光、圈选、会话回放；开关由后端配置
- WebSocket 推送站内消息，支持强退
- 登录密码 SM2 加密传输
- vue-i18n 中英文切换
- `pnpm gen:api` 从 OpenAPI 生成 `src/types/api/openapi.d.ts`
- Playwright 端到端测试走真实浏览器和验证码流程

## 架构

请求分层：页面 → hooks → api → 后端。埋点 SDK 走同一 dev 代理。

```mermaid
flowchart LR
    subgraph FE[mugsun-pc]
        V[views] --> H[hooks]
        H --> A[api]
        V -. 埋点 .-> T[@mugsun/track-web]
    end
    A --> P[vite 代理 :3006→:8080]
    T --> P
    P --> B[mugsun-boot :8080]
    B --> DB[(PostgreSQL / Redis)]
```

## 快速开始

需要 **Node.js ≥ 20.19**、**pnpm ≥ 8.8**（仓库锁 `pnpm@11.9.0`，建议 `corepack enable`）。

四个仓库平级 clone：

```
mugsun/
├── mugsun-core
├── mugsun-boot      # :8080
├── mugsun-pc        # 本仓
└── mugsun-track     # 埋点 SDK
```

本仓用 `file:../mugsun-track` 引用 SDK，`dist/` 不在 git 里。**先构建 SDK 再装依赖**：

```bash
cd ../mugsun-track && pnpm install && pnpm build

cd ../mugsun-pc
pnpm install
pnpm dev
```

浏览器打开 http://localhost:3006（端口见 `.env` 的 `VITE_PORT`）。

`/api/**` 由 vite 代理到 `http://localhost:8080`，请先启动 mugsun-boot。

## 常用脚本

| 命令                     | 说明                            |
| ------------------------ | ------------------------------- |
| `pnpm dev`               | 开发服务器，默认 3006           |
| `pnpm dev:e2e`           | 3007 端口，给 e2e 用            |
| `pnpm build`             | 类型检查 + 生产构建             |
| `pnpm serve`             | 预览构建产物                    |
| `pnpm gen:api`           | 从 `:8080/v3/api-docs` 生成类型 |
| `pnpm test:e2e`          | Playwright                      |
| `pnpm lint` / `pnpm fix` | ESLint                          |
| `pnpm commit`            | git-cz 交互提交                 |
| `pnpm clean:dev`         | 清模板示例路由/页面             |

## 端到端测试

`playwright.config.ts` 默认 `baseURL` 为 http://localhost:3007，与日常 dev 端口分开。

```bash
# mugsun-boot(:8080)、PostgreSQL(mugsun-pg)、Redis(blade-redis) 已启动
pnpm setup:sdk
pnpm dev:e2e    # 终端 A
pnpm test:e2e   # 终端 B
```

登录用例从 Redis 读图形验证码（`docker exec <redis> redis-cli`），不跳过后端校验。容器名可用 `E2E_REDIS_CONTAINER`、`E2E_REDIS_DB`（默认 3）覆盖。

## 目录

```
src/
├── api/          # 按模块分的请求
├── components/   # 通用 + 业务组件
├── hooks/        # useTable / useCrud / useDict
├── locales/      # i18n
├── plugins/      # 埋点 SDK 等
├── router/       # 守卫 + 动态菜单路由
├── store/        # Pinia
├── types/api/    # openapi.d.ts（gen:api 生成，勿手改）
└── views/
```

提交信息见 [.github/COMMIT_CONVENTION.md](.github/COMMIT_CONVENTION.md)。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=mugsun/mugsun-pc&type=Date)](https://star-history.com/#mugsun/mugsun-pc&Date)

## 许可证

[MIT License](./LICENSE)
