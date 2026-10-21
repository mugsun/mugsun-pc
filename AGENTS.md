# AGENTS.md — mugsun-pc

本文件写给在本仓工作的开发者和 AI 助手。内容以本仓代码为准；与代码不一致时以代码为准，并请顺手修正本文件。

## 仓库是什么

PC 管理台（Vue 3 + Vite + Element Plus + TypeScript），对接 mugsun-boot。包管理：`pnpm`（见根 `package.json` 的 `packageManager`）。

本仓**没有** Flyway 或 Java 实体；后端约定见 mugsun-boot / mugsun-core 的 `AGENTS.md`。

## 目录分层

| 路径 | 作用 |
| --- | --- |
| `src/views/` | 页面（`system`、`auth`、`dashboard`、`exception`、`index`、`outside` 等） |
| `src/api/` | 接口封装（按资源拆文件，部分有子目录如 `dict/`、`role/`、`user/`；走 `@/utils/http`） |
| `src/router/` | 路由 |
| `src/config/` | `AppConfig` 与 `setting` 默认配置 |
| `src/types/` | 类型定义（含 `gen:api` 生成的 `types/api/openapi.d.ts`） |
| `src/directives/`、`src/enums/`、`src/plugins/`、`src/assets/` | 指令、枚举、插件、静态资源 |
| `src/mock/` | 仅演示数据（`json`、`temp`、`upgrade`），**不是**接口 mock 层 |
| `src/components/` | 通用组件（`core/`、`business/`） |
| `src/hooks/core/` | 组合式逻辑（`useCrud`、`useAuth`、`useDict` 等） |
| `src/store/modules/` | Pinia 模块（`user`、`menu`、`setting` 等） |
| `src/locales/langs/` | `zh.json` / `en.json` |
| `src/utils/http/` | Axios 封装（Token、401、去重、下载） |
| `modules/` | 可选模块 `ai`、`gis`、`track`。**不是** workspace 包：构建期由 `src/modules/flags.ts` 开关（`VITE_ENABLE_*`），vite 别名按目录是否存在接入（`vite.config.ts` 的 `@/gis`、`@/api/gis`、`@/views/track` 等）；删除目录即可去掉 |

接口基址：`import.meta.env.VITE_API_URL`（见 `src/utils/http/index.ts`）。

## 命名与写法

- 新列表页优先复用 `useCrud`（`src/hooks/core/useCrud.ts`）：列表 + 弹窗 + 删除 + 保存。
  - 参数：`listApi`（必填）、`saveApi`（新增与编辑共用一个端点）、`removeApi`、`columnsFactory`、`apiParams`（默认 `{ pageNum: 1, pageSize: 20 }`）、`paginationKey`、`idKey`、`label`、`rowName`、`responseAdapter`、`serverSuccess`。
  - 返回：`useTable` 的全部返回，外加 `dialogVisible`、`dialogType`、`currentRow`、`showDialog`、`handleDelete`、`handleSubmit`。
  - 默认适配 MyBatis-Flex 分页体（`records` / `totalRow`），也兼容纯数组和 `pageNumber` / `pageSize`。
  - 删除后页码会回退、新增回首页、编辑保持当前页。
  - 最小示例（参考 `src/views/system/param/index.vue`）：
    ```ts
    const { showDialog, fetchData, replaceSearchParams } = useCrud({
      listApi: fetchParamPage,
      saveApi: fetchSaveParam,
      removeApi: fetchRemoveParam,
      columnsFactory,
      label: t('pages.system.param.label'),
      rowName: (row) => row.paramName
    })
    ```
- API 函数放在 `src/api/<资源>.ts` 或其子目录，命名常见 `fetchXxx` / `fetchSaveXxx` / `fetchRemoveXxx`（个别例外如 `unlockLoginAccount`）；页面通过 `@/api/...` 引用。
- 文案走 i18n，不要只写死中文：
  - 语言包是 `src/locales/langs/zh.json` 与 `en.json`（Element Plus 语言包在 `src/locales/element.ts`），嵌套 camelCase 分组：页面放 `pages.<模块>.<页面>`，通用放 `common`。
  - 脚本里用 `$t`（from `@/locales`），组件里用 `useI18n().t`。
  - 改 UI 文案时 zh / en **一起改**。`tests/unit/locales/` 有消息编译和英文不含中文字符的单测；zh/en key 是否一一对应需要自查。
- 暗色与主题读 `setting` store / `AppConfig`（`src/config/`）；改样式时要覆盖暗色。

## 租户与权限（前端侧）

- 登录态、token 与 `logOut` 在 `src/store/modules/user.ts`；`useAuth`（`src/hooks/core/useAuth.ts`）只管按钮权限 `hasAuth`。请求由 http 拦截器带 Token。
- 菜单与按钮权限以后端下发为准；不要在前端硬编码「跳过权限」。
- 租户切换、跨租户能力以后端会话为准；不要伪造或依赖请求头绕过后端校验。

## UI 验收（改界面时必做）

只读代码不算通过。改界面的 PR 必须逐项完成 `.github/pull_request_template.md` 的「界面自查清单」：每项附截图，或写明不适用的原因，否则视为阻塞。清单以模板为准，这里不另抄一份。

- 审阅者至少亲自看空着提交、英文、暗色、390px 四种状态。
- CI 的 `UI self-check` 只覆盖 1440px 宽，**不覆盖 390px**，窄屏必须手动自查。

## 组件速查

| 需求                 | 位置                                                |
| -------------------- | --------------------------------------------------- |
| HTTP 客户端          | `src/utils/http`                                    |
| CRUD 样板            | `src/hooks/core/useCrud.ts`                         |
| 国密相关工具         | `src/utils/gm.ts`                                   |
| 验证码               | `src/utils/captcha/`、`src/components/core/captcha` |
| 布局 / 表格 / 表单   | `src/components/core/{layouts,tables,forms}`        |
| 埋点 / GIS / AI 页面 | `modules/{track,gis,ai}/views`                      |

## 测试与构建

```bash
pnpm install
pnpm run typecheck          # vue-tsc --noEmit
pnpm run test               # vitest run
pnpm run build              # typecheck + vite build
pnpm run test:e2e           # playwright
pnpm run test:e2e:captcha-on # 开启验证码的 e2e
pnpm run test:ui-check      # playwright.ui.config.ts
pnpm run lint
pnpm run fix                # eslint --fix
pnpm run dev                # vite --open
pnpm run dev:e2e            # 3007 端口，供 e2e 使用
pnpm run gen:api            # 需本地 8080 已运行 boot，生成 src/types/api/openapi.d.ts
pnpm run commit             # cz-git 交互式提交
pnpm run clean:dev
```

`playwright.csp.config.ts` 与 `e2e-csp/` 目前没有对应脚本。

CI 的必需检查是 `Build` 和 `UI self-check`（`.github/workflows/ci.yml`）。

埋点 SDK：不管开不开埋点，都必须平级 clone `../mugsun-track`，否则 `pnpm install` 会失败。首次先 `pnpm run setup:sdk`，再 `pnpm install`。

pre-commit：`.husky/pre-commit` 使用 `pnpm exec lint-staged --no-stash`（**不要**改回会建 stash 的默认行为）。`package.json` 的 `lint:lint-staged` 脚本也已带 `--no-stash`。

## 本地构建

- 重型任务（构建、类型检查、e2e、测试容器、dev server 等）一律经仓库父目录 `mugsun/` 下的 `_locks/heavy.sh` 排队，同一时间只跑一个：
  ```bash
  ../_locks/heavy.sh <名字> <做什么> -- <命令...>
  # 例：../_locks/heavy.sh 平台后端工程师 "core 单测" -- mvn -q test
  ```
- 前面有任务时脚本每 30 秒重试并打印当前占用者；空闲内存低于 30% 时不开跑（退出码 75），先停掉闲置的 dev server 再试。
- 脚本会在未设置时自动设 `NODE_OPTIONS=--max-old-space-size=3072`，不要在命令里再调大。
- dev server 用完即停，不要挂着。

## 提交与推送

- Conventional Commits，主题中文，不超过 50 字，不用 emoji；详见 `.github/COMMIT_CONVENTION.md`。
- `CHANGELOG.md` 写在 `## [Unreleased]` 下，**每行不超过 80 字**。
- 不用 `git stash`；切换工作用 `git worktree`。
- **只有分支最新的 commit 已经在分支上跑过同名必需检查、并且全绿，才可以快进推入 main。推送前用 `gh run list --commit <sha>` 自己确认。不要 force push。**
- 推 main 前的防误推（3.20）：
  - 推 main 前显式核对：这个完整 SHA 已经审过（审查结论里写的就是它），并且 `gh run list --commit <完整 SHA>` 显示同名检查全绿。短 SHA 查询可能返回空，不算核对。
  - 推送一律写全 refspec：`git push origin <sha>:refs/heads/<分支>`，不用裸 `git push`，也不依赖 upstream 跟踪。
  - 还没审的本地提交，不放在跟踪 main（upstream 为 `origin/main`）的分支上。
  - 改动 `.github/` 下任何文件的提交，必须先有安全官签字，才能进 main。
  - 一个 worktree 只给一条工作线用，另开的工作线一律新建自己的 worktree。
  - 推送前用 `git rev-parse HEAD` 对照审过的完整 SHA；推送时不推 `HEAD`，写明 SHA，例如 `git push origin <sha>:refs/heads/main`（反例：如 `git push origin HEAD:main`）。
  - Mac mini 上的 zsh 会把 `$S:refs/...` 里的 `:r` 当成变量修饰符，把 refspec 改坏；refspec 里要么直接写 SHA 字面量，要么写成 `"${S}:refs/heads/<分支>"`。
  - push 被打断时，先用 `git ls-remote` 和 `ps` 确认它没有在后台跑完，再做下一步。
- 合入后作者自行删除远端分支。
- 提交的作者和提交者一律是 `mugsun <bydongxin@gmail.com>`：用 `git -c user.name=mugsun -c user.email=bydongxin@gmail.com commit` 或仓库级 config，不改全局配置。已推送的历史（含 main 上以 noreply 等旧身份提交的）一律不改写、不 force push。
- 登录 / 验证码 / 加解密 / 新依赖 / CI workflow 属于敏感改动，需安全审查。
