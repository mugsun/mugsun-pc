![mugsun-pc](https://raw.githubusercontent.com/mugsun/mugsun-docs/main/public/brand/banners/repos/mugsun-pc-en.png)

# mugsun-pc

[简体中文](./README.md) | English

This repository is the mugsun admin console. Menus and button permissions are delivered by [mugsun-boot](https://github.com/mugsun/mugsun-boot). GIS, analytics, and AI capabilities are assembled as optional front-end modules. In development, Vite proxies `/api` to the local boot service.

[Documentation](https://docs.mugsun.com/en/pc/) · [Getting started](https://docs.mugsun.com/en/guide/getting-started) · [Demo](https://docs.mugsun.com/en/demo)

![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white) ![Element%20Plus](https://img.shields.io/badge/Element%20Plus-2.11-409EFF) ![pnpm](https://img.shields.io/badge/pnpm-11.28-F69220?logo=pnpm&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-green.svg)

## Overview

| Item | Detail |
| --- | --- |
| Package | `mugsun-pc` |
| Version | `0.1.0` (see `package.json`) |
| Runtime | Node.js ≥ 22.13; pnpm ≥ 11.11 (`packageManager` locks `pnpm@11.28.2`) |
| Stack | Vue 3.5 · Vite 7 · Element Plus 2.11 · Pinia · Vue Router |
| Backend | [mugsun-boot](https://github.com/mugsun/mugsun-boot) (development default `http://localhost:8080`) |
| License | [MIT](./LICENSE); UI-base credit in [NOTICE](./NOTICE) |
| Docs | [docs.mugsun.com/en/pc](https://docs.mugsun.com/en/pc/) |

The console does not maintain a separate permission model: sidebar menus, button codes, and user context come from boot APIs such as `/api/auth/info`. Optional modules are gated by build-time environment variables; when disabled, routes and plugins are not registered, and removing the module directory removes the source.

## Deployment

Prerequisites: Node.js ≥ 22.13, pnpm ≥ 11.11; [mugsun-boot](https://github.com/mugsun/mugsun-boot) running on `:8080`. Whether or not the track module is enabled, clone [mugsun-track](https://github.com/mugsun/mugsun-track) as a **sibling**; otherwise `pnpm install` fails because `../mugsun-track` is missing (`@mugsun/track-web` is referenced as `file:../mugsun-track`; the SDK repository does not commit `dist/`).

```bash
pnpm setup:sdk   # install + build ../mugsun-track; the build can be skipped when VITE_ENABLE_TRACK=false, but the sibling directory must still exist
pnpm install
pnpm dev
```

Development URL: http://localhost:3006 (`VITE_PORT`). `/api/**` proxies to `VITE_API_PROXY_URL` in `.env.development` (default `http://localhost:8080`). Login credentials match boot (default `admin` / `123456`).

Sibling layout:

```text
mugsun/
  mugsun-core/
  mugsun-boot/     # :8080
  mugsun-pc/       # this repository :3006
  mugsun-track/    # file: dependency (always needed by pnpm install)
```

Walkthrough: [Documentation · Getting started](https://docs.mugsun.com/en/guide/getting-started).

Package:

```bash
pnpm build
# preview: pnpm serve
```

## Composition

```text
mugsun-pc/
  src/                 # shell: router, auth, system views, API client
  modules/
    gis/               # optional: layers, scenes, spatial analysis
    track/             # optional: access management and analytics console (depends on @mugsun/track-web)
    ai/                # optional: models, chat, knowledge base, MCP admin pages
```

Build-time flags (all enabled by default; set to `false` to disable):

| Variable | Effect |
| --- | --- |
| `VITE_ENABLE_GIS` | Registers GIS routes and aliases; `modules/gis` may be removed when off |
| `VITE_ENABLE_TRACK` | Registers track routes and SDK plugin; skip `setup:sdk` and remove `modules/track` when off (the sibling `../mugsun-track` must still exist for `pnpm install`) |
| `VITE_ENABLE_AI` | Registers AI routes and plugin; `modules/ai` may be removed when off |

Request path: views and hooks call `/api` via axios; Vite proxies to boot in development. The analytics SDK posts to same-origin `/api/track/collect`, which is likewise proxied into boot’s track module.

The UI base derives from [art-design-pro](https://github.com/Daymychen/art-design-pro) (MIT). See [NOTICE](./NOTICE).

## Scope

**Provided**

- Backend-driven menus and system administration pages aligned with boot
- Optional GIS / analytics console / AI front-end modules with build-time switches
- Development reverse proxy to a live boot instance (no full replaceable mock layer)
- Sibling integration path for `@mugsun/track-web` (`pnpm setup:sdk`)

**Not provided**

- A backend independent of boot, or a complete replaceable mock service
- A publicly accessible demo environment (local verification uses boot + this repository; see [Demo](https://docs.mugsun.com/en/demo))

Routes, environment variables, and scripts are defined in the [documentation](https://docs.mugsun.com/en/pc/) and source tree.

## Related projects

Open-source line: `boot` · `core` · `pc` · `track` · [mugsun-docs](https://github.com/mugsun/mugsun-docs).

| Repository | Relationship |
| --- | --- |
| [mugsun-boot](https://github.com/mugsun/mugsun-boot) | Backend APIs; CORS / OAuth redirect defaults to this console’s development port `3006` |
| [mugsun-track](https://github.com/mugsun/mugsun-track) | Browser SDK; this repository uses `file:`; application projects should prefer the npm package |
| [mugsun-core](https://github.com/mugsun/mugsun-core) | Shared backend kernel; not a direct dependency of this repository |
| [mugsun-docs](https://github.com/mugsun/mugsun-docs) | Documentation site [docs.mugsun.com](https://docs.mugsun.com/) |

## Local development

```bash
pnpm test          # vitest
pnpm test:e2e      # playwright (see repository config)
pnpm lint          # eslint
pnpm gen:api       # generate types from boot OpenAPI (boot must be running)
```

## License

[MIT](./LICENSE) · UI-base credit in [NOTICE](./NOTICE)
