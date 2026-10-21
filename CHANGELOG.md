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

- 登录、短信登录发码、注册、忘记密码改用多类型行为验证码（滑块 / 旋转 / 文字点选 / 图标点选 / 拼图还原，题型由服务端决定）
- 移除数字验证码；配置获取失败时显示可重试的错误态，不再回落。错误态带错误编号（即该次请求的 `X-Trace-Id`），不弹提示框，读屏播报一次；验证码就绪前提交按钮不可用
- 修复登录页「第三方登录」分隔线文字底色与页面背景不一致（暗色下灰块、亮色窄屏下白块）

### 计划

- （暂无已定条目）

[Unreleased]: https://github.com/mugsun/mugsun-pc/commits/main
