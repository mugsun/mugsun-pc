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

- AI：应用编排支持 foreach / parallel 控制节点（DEV mock）
  - palette 可拖入；属性面板有序 bodyNodeIds / branches
  - 运行结果展示 iterations[] / branches[]（truncated/partial）
  - DEV 仅 `VITE_AI_FLOW_CONTROL_MOCK=true` 走本地同形 mock

- 审批流：设计器/实例对接 AI 节点（type=ai）
  - GraphAdd/graph-model/toTree/validate；绑已启用 AiApp
  - 实例 history 渲染 aiTrace；抽屉展示 AI 写回变量
  - 契约收紧：inputMap 字段必填（{}可零注入）；outputMap 目标键白名单；timeoutMs≤300000
  - 修复：outputMap 白名单改校映射值（to）；from 侧普通变量名
  - 修复：AI 映射删行按钮进 btn-permission EXEMPT（同设计器本地 splice）
  - `VITE_FLOW_AI_MOCK` 默认 false，接真 API；仅 DEV+true 走下拉 mock

- 埋点：空间行为 query 列表改逗号串，漏斗步骤改正整数
  - eventNames/funnelSteps `join(',')`，避免 axios `[]=`
  - funnelSteps 对齐 boot parseFunnelSteps（正整数）

- 埋点：空间行为页（agg 热力 / points 点选）
  - 路由 `/track/spatial`；读 `sys:track-spatial:list`
  - `GET /api/system/track/spatial`；DEV 仅 `VITE_TRACK_SPATIAL_MOCK=true` mock
  - 菜单随后端种子；默认关 mock 接真 API
  - 组合 GisSpatialMap；viewport 重拉；点选跳回放/用户

- GIS：GisSpatialMap 空间行为热力/点选（合 boot spatial）
  - props：mode/cells/points；weight 回退 count
  - emit：viewport、select-point；旧 GisHeatMap 不动

- AI：知识库资料支持 PDF/Word/PPT 文档解析上传
  - multipart `POST .../asset/upload-file`；权限 `ai:kb-asset:upload`
  - 列表展示 failReason；pending 轮询进度；分段可按资料筛

- 埋点：问数据对齐 boot 真出参（resultType/series）
  - 兼容 metrics/unsupported/raw；趋势行 [{date,pv,uv}]
  - mock 动态 import；raw 结构化兜底

- 埋点：问数据默认接真 API（合 boot ask 后）
  - `POST /api/system/track/ask`；读 `sys:track-ask:list`
  - DEV 仅 `VITE_TRACK_ASK_MOCK=true` 走本地同形 mock
  - 菜单图标对齐 boot `ri:chat-search-line`

- 埋点：问数据页骨架（中文提问 → 指标/图/表 → 相关回放）
  - 路由 `/track/ask`；真路径 `POST /api/system/track/ask`
  - 读 `sys:track-ask:list`；回放跳 replay 带 sessionId+appKey
  - 与 AI dataset 问数无关

- 埋点：错误问题单详情/写路径补 appKey（合后跟）
  - 与 boot loadIssue(id+appKey+租户) 对齐；缺 appKey 不发请求

- 埋点：错误问题单页（release 筛 + 指派/解决/重开）
  - 跳回放/用户；真路径 `/api/system/track/error-issues*`
  - 404 友好空态；读 list / 写 edit 权限

- CI：加固 dist no-eval 白名单指纹，并扫 Function(（#64 合后跟）
  - 前缀白名单须过内容指纹；负向夹具 scripts/ci/fixtures/dist-no-eval/

- CI：offline-icons 对照钉 boot tip，并对齐 ICON_PREFIXES（#62 合后跟）
  - Build 稀疏 checkout 钉 bee6abf；前缀与单测/json 交叉注释

- CI：对照 boot 种子菜单图标与 offline-icons（#62）
  - Build 稀疏拉 mugsun-boot@main 种子 SQL；scripts/ci/check-offline-icons-vs-boot.sh

- CI：扫 dist 产物禁入口/i18n 的 new Function（#64）
  - build 后跑 scripts/ci/check-dist-no-eval.sh；第三方 chunk 白名单带来源

- 全页助手失败重试去双重提示，补 retryNeedRefresh 行为单测
  - stream onError 只留行内 ElAlert；与抽屉同语义
  - chatRegenerate 抽 decide/applyChatRetry，覆盖已入库无 messageId
- AI 抽屉重试改调 boot `POST /system/ai/chat/regenerate`（#71）
  - 已入库失败重试不重复写提问；校验失败仍走 stream
  - SSE 同 stream；捕获 done/messageId 供再次 regenerate
- CI：csp-e2e demo 日志库改用 owner 口令，修 enforce 登录 499/停登录页
- CSP 绕过补 e2e（#65）收口项8/11，并消化 #63 合后建议
  - 6 sendBeacon / 7 回放(录制真、播放 fixture) 已覆盖
  - 11 report-uri：demo 收集端 204、日志去 query、限流 429
  - 8 WebSocket：prod,demo 下伪造 Origin 非 101（F7）
  - demo 栈下项7录制改走工作台/埋点概览（避免用户/角色 POST 被只读拦）
  - csp-e2e 开 demo（migrate→boot）+ report-uri；钉 boot@a02dd282
  - 失败 compose-logs 仅 step 日志，不进公仓 artifact
  - 去掉口令回落；导出真实 Redis/PG/boot 容器名
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
