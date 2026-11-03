# crypto 演示页 UI 四态自查（零配置 tip）

对应分支 `chore/track-web-npm-zero-config`；截图为前端 mock，**不入库**。水印：「前端 mock 数据」。mock keyHex 仅自测用，非真实环境密钥。

## 四态结论

| 态 | 结论 | box 路径 |
| --- | --- | --- |
| 1. 空提交 | 有：清空输入点「加密发送」→ 顶部黄条「请输入文本」 | `/workspace/review/pc-crypto-ui-shots/01-empty-submit-zh-light.png` |
| 2. 英文长文案 | 有：en info Alert 长文案 + 页内 error Alert；按钮 disabled；无顶栏重复 toast | `/workspace/review/pc-crypto-ui-shots/02-en-long-copy-light.png` |
| 3. 暗色 | 有：zh dark，卡片/Alert/按钮对比正常 | `/workspace/review/pc-crypto-ui-shots/03-dark-zh.png` |
| 4. 390px 窄屏 | 有：错误 Alert 与按钮可读，长文案换行 | `/workspace/review/pc-crypto-ui-shots/04-narrow-390-zh.png` |

复现（可选，不进主 CI）：`pnpm exec playwright test -c playwright.crypto-shots.config.ts`

## 同批代码

- `env.d.ts`：`VITE_CAPTCHA_MOCK` 注释归位。
- 双提示收敛：`ensureTransportKey(..., { silent: true })` 用于路由拉钥与演示页；失败只留演示页 Alert（或后续加密请求错误），不再 ElMessage+Alert 双打。
- 竞态：`keyEpoch`；`clearTransportKey` 自增；在途 bootstrap 返回后 epoch 已变则丢弃，防登出写回。单测已覆盖。

## 未跑

- W1-R3 需 boot 联调；本轮未起 boot，跳过。
