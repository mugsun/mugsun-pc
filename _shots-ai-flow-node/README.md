# 流程设计里 AI 节点的界面自查

这是给「流程设计」页面加 AI 节点时留下的自查记录。这个目录原本打算放截图，截图一直没有补，现在只有这份说明。

## AI 节点是什么

AI 节点把一个已启用的 AI 应用接进审批流，应用的类型要是工作流或对话流。节点上可以设置入参和出参的映射、超时时间，以及失败后怎么处理。

| 路径                                           | 内容                         |
| ---------------------------------------------- | ---------------------------- |
| `src/views/system/flow-graph/GraphChain.vue`   | 设计器里的节点卡片           |
| `src/views/system/flow-graph/flow-ai-apps.ts`  | 读取可以绑定的 AI 应用       |
| `src/views/system/flow-graph/flow-ai-mock.ts`  | 本地模拟数据                 |
| `src/views/system/flow-center/index.vue`       | 「审批中心」里的 AI 执行记录 |
| `tests/unit/system/flow-graph-ai-node.test.ts` | 单元测试                     |

## 自查了哪些状态

| 状态        | 要求                                              |
| ----------- | ------------------------------------------------- |
| 空状态      | 没有选 AI 应用时，校验不通过                      |
| 出错状态    | AI 执行出错时，审批中心里的执行记录显示为错误样式 |
| 加载状态    | AI 应用下拉框加载时显示加载动画                   |
| 语言        | 中文和英文都有文案，界面上不露出文案的键名        |
| 暗色主题    | 颜色都用 Element Plus 的变量                      |
| 390 像素宽  | 节点卡片宽 320 像素，画布可以滚动                 |
| 1440 像素宽 | 显示正常                                          |
| 键盘        | 下拉框可以用键盘选择                              |

这些状态当时是靠单元测试和类型检查确认的，没有留截图。

## 不连后端查看

在 `.env.development.local` 里加一行，再运行 `pnpm dev`：

```ini
VITE_FLOW_AI_MOCK=true
```

这时 AI 应用下拉框会列出两条本地的模拟数据。这个开关只在开发模式下有效，构建出来的产物里没有模拟数据。

## 运行测试

```bash
pnpm test tests/unit/system/flow-graph-ai-node.test.ts
```
