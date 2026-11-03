# 更新日志

本文件记录 [mugsun-pc](https://github.com/mugsun/mugsun-pc) 的重要变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 说明

- `package.json` 版本为 `0.1.0`，尚未发布正式 npm / GitHub Release
- 以下条目概括当前 `main` 能力，便于对照；首个正式版本发布时将收束到对应 tag 章节

### 已有能力（开发中）

- Vue 3 管理控制台骨架与路由
- 与 `mugsun-boot` 联调约定见 README 与文档站

### 变更

- CSP 绕过补 e2e（#65）并消化 #63 合后建议
  - 新增 sendBeacon / 回放 iframe / WS 伪造 Origin；report-uri 骨架 skip
  - 去掉口令 `|| '123456'`；导出真实 Redis/PG 容器名；AGENTS 澄清 required
- CI 接入 CSP 强制模式 e2e（#63）
  - 新增 `csp-e2e` job：compose 起栈（enforce）后跑 e2e-csp
  - 结果 JSON 作 artifact；本地脚本 `scripts/ci/run-csp-e2e.sh`
- 跟版 boot#81：一次性口令展示与首次登录强制改密
  - 建租户 / 建用户（未填密）/ 重置口令 / 导入新建：弹窗展示可复制口令
  - 登录后 `needChangePassword` 时路由只放行个人中心改密页
  - 强制改密期禁用昵称/头像；OTP 未复制关窗二次确认；复制按钮「已复制」反馈
  - 去掉「初始口令=环境变量」类文案
  - 体验已在 f8a6cb4 验收（其后 tip 仅截图脚本硬化，业务以该提交为准）
- 接口传输密钥改为登录后 `/api/crypto/bootstrap` 下发，只存内存
  - 去掉演示页内置回落密钥；构建期 `VITE_CRYPTO_API_KEY` 可选且须与后端一致
  - 登出 / 未登录不请求；失败或密钥不一致则禁用加密并提示
- 默认依赖改为 npm `@mugsun/track-web@0.3.0`，去掉必平级克隆与 `setup:sdk`
  - CI / Dockerfile / compose 不再克隆或构建 mugsun-track
  - 联调 SDK 源码改为可选的 `pnpm link` 或 `.npmrc` link 覆盖
- 锁屏去掉固定混淆值 `VITE_LOCK_ENCRYPT_KEY`，密码只以加盐 hash 存在内存里
  - 每次锁屏用 `crypto.getRandomValues` 生成 16 字节盐，用 `crypto.subtle` 算 SHA-256
  - 算完 hash 即丢弃明文；解锁成功或登出时 hash 与盐一起清掉
  - 不写 localStorage、sessionStorage，也不进 pinia 持久化
  - 锁屏只是遮挡界面，不是安全边界，刷新页面就会解锁
- 登录、短信登录发码、注册、忘记密码改用多类型行为验证码（滑块 / 旋转 / 文字点选 / 图标点选 / 拼图还原，题型由服务端决定）
- 移除数字验证码；配置获取失败时显示可重试的错误态，不再回落。错误态带错误编号（即该次请求的 `X-Trace-Id`），不弹提示框，读屏播报一次；验证码就绪前提交按钮不可用
- 登录、注册、忘记密码页 logo 跟随主题：7 个预设主题色亮色用 B 版（浅底）、暗色用 A 版（深底），切换主题色或亮暗即时生效；自定义主题色回退原版黑金方标；橙、粉 B 版加 1px 描边。字标为 Saira 600 的「MUGSUN」（亮 #1F2329、暗白色），≤640px 图标 28px，<360px 隐藏字标。侧边栏、顶栏、锁屏、favicon 不变（`AuthBrandLogo`、`utils/brand/themeLogo`）
- 修复登录页「第三方登录」分隔线文字底色与页面背景不一致（暗色下灰块、亮色窄屏下白块）

### 计划

- （暂无已定条目）

[Unreleased]: https://github.com/mugsun/mugsun-pc/commits/main
