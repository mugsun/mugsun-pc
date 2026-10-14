![mugsun-pc](https://raw.githubusercontent.com/mugsun/mugsun-docs/main/public/brand/banners/repos/mugsun-pc.png)

# mugsun-pc

**中文** | [English](./README_EN.md)

本仓库为 mugsun 管理端。菜单与按钮权限由 [mugsun-boot](https://github.com/mugsun/mugsun-boot) 下发；地理信息、行为分析与人工智能能力以可选前端模块装配。开发期通过 Vite 将 `/api` 代理至本机 boot 服务。

[文档](https://docs.mugsun.com/pc/) · [快速开始](https://docs.mugsun.com/guide/getting-started) · [演示说明](https://docs.mugsun.com/demo)

![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white) ![Element%20Plus](https://img.shields.io/badge/Element%20Plus-2.11-409EFF) ![pnpm](https://img.shields.io/badge/pnpm-11.28-F69220?logo=pnpm&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-green.svg)

## 概述

| 项 | 说明 |
| --- | --- |
| 包名 | `mugsun-pc` |
| 版本 | `0.1.0`（以 `package.json` 为准） |
| 运行时 | Node.js ≥ 22.13；pnpm ≥ 11.11（`packageManager` 锁定 `pnpm@11.28.2`） |
| 技术栈 | Vue 3.5 · Vite 7 · Element Plus 2.11 · Pinia · Vue Router |
| 后端 | [mugsun-boot](https://github.com/mugsun/mugsun-boot)（开发默认 `http://localhost:8080`） |
| 许可 | [MIT](./LICENSE)；UI 基座致谢见 [NOTICE](./NOTICE) |
| 文档 | [docs.mugsun.com/pc](https://docs.mugsun.com/pc/) |

管理端不维护独立权限模型：侧边栏菜单、按钮码与用户信息来自 boot 的 `/api/auth/info` 等接口。可选模块由构建期环境变量控制；关闭后不注册路由与插件，删除对应目录可去除源码。

## 部署

前置条件：Node.js ≥ 22.13、pnpm ≥ 11.11；[mugsun-boot](https://github.com/mugsun/mugsun-boot) 已在 `:8080` 运行。无论是否开启埋点，都须与 [mugsun-track](https://github.com/mugsun/mugsun-track) **平级** clone，否则 `pnpm install` 会因找不到 `../mugsun-track` 而失败（`@mugsun/track-web` 以 `file:../mugsun-track` 引用，源码仓不提交 `dist/`）。

```bash
pnpm setup:sdk   # 对 ../mugsun-track 执行 install + build；VITE_ENABLE_TRACK=false 时可跳过构建，但平级目录仍须存在
pnpm install
pnpm dev
```

开发地址：http://localhost:3006（`VITE_PORT`）。`/api/**` 代理至 `.env.development` 中的 `VITE_API_PROXY_URL`（默认 `http://localhost:8080`）。登录账号与 boot 一致（默认 `admin` / `123456`）。

平级目录约定：

```text
mugsun/
  mugsun-core/
  mugsun-boot/     # :8080
  mugsun-pc/       # 本仓 :3006
  mugsun-track/    # file: 依赖（pnpm install 恒需要）
```

逐步说明见 [文档 · 快速开始](https://docs.mugsun.com/guide/getting-started)。

打包：

```bash
pnpm build
# 预览：pnpm serve
```

## 组成

```text
mugsun-pc/
  src/                 # 壳层：路由、鉴权、系统管理视图、API 封装
  modules/
    gis/               # 可选：图层、场景、空间分析等
    track/             # 可选：接入管理与分析看板（依赖 @mugsun/track-web）
    ai/                # 可选：模型、对话、知识库、MCP 等管理页
```

构建期开关（默认均为开启；设为 `false` 关闭）：

| 变量 | 作用 |
| --- | --- |
| `VITE_ENABLE_GIS` | 注册 GIS 路由与相关别名；关闭时可删除 `modules/gis` |
| `VITE_ENABLE_TRACK` | 注册埋点路由与 SDK 插件；关闭时可跳过 `setup:sdk` 并删除 `modules/track`（平级 `../mugsun-track` 目录仍须存在，供 `pnpm install` 解析） |
| `VITE_ENABLE_AI` | 注册 AI 路由与插件；关闭时可删除 `modules/ai` |

请求链路：视图与 hooks 经 axios 访问 `/api`；开发期由 Vite 代理至 boot。埋点 SDK 经同源 `/api/track/collect` 上报，同样经代理进入 boot 的 track 模块。

UI 基座衍生自 [art-design-pro](https://github.com/Daymychen/art-design-pro)（MIT），版权与许可说明见 [NOTICE](./NOTICE)。

## 能力范围

**已提供**

- 与 boot 同源的菜单权限与系统管理页面
- 可选 GIS / 埋点看板 / AI 前端模块及构建期开关
- 开发期对真实 boot 的反向代理（无独立完整 mock 层）
- 与 `@mugsun/track-web` 平级联调路径（`pnpm setup:sdk`）

**暂未提供**

- 脱离 boot 的独立后端或可替换完整 mock 服务
- 可公开访问的在线演示环境（本地通过 boot + 本仓联调，见 [演示说明](https://docs.mugsun.com/demo)）

页面路由、环境变量与脚本以 [文档](https://docs.mugsun.com/pc/) 及源码为准。

## 关联项目

开源主线：`boot` · `core` · `pc` · `track` · [mugsun-docs](https://github.com/mugsun/mugsun-docs)。

| 仓库 | 与本仓库的关系 |
| --- | --- |
| [mugsun-boot](https://github.com/mugsun/mugsun-boot) | 后端 API；CORS / OAuth 回跳默认指向本仓开发端口 `3006` |
| [mugsun-track](https://github.com/mugsun/mugsun-track) | 浏览器 SDK；本仓以 `file:` 引用，业务项目宜用 npm 包 |
| [mugsun-core](https://github.com/mugsun/mugsun-core) | 后端共享内核；本仓不直接依赖 |
| [mugsun-docs](https://github.com/mugsun/mugsun-docs) | 文档站 [docs.mugsun.com](https://docs.mugsun.com/) |

## 本地开发

```bash
pnpm test          # vitest
pnpm test:e2e      # playwright（见仓库配置）
pnpm lint          # eslint
pnpm gen:api       # 自 boot OpenAPI 生成类型（须 boot 已启动）
```

## 许可

[MIT](./LICENSE) · UI 基座致谢见 [NOTICE](./NOTICE) · © 2026 北京定旭晨 / mugsun
