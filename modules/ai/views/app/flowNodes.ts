/**
 * 应用编排画布的节点名规则（pc#47 复审）：
 * - 用户没改过名的节点不存 label（存空），显示时按 type 走 i18n 实时翻译；
 * - 用户改过名的节点按原样保存与显示；
 * - 旧流程里存着默认中文名的节点视为没改过名（LEGACY_DEFAULT_LABELS），加载时清空。
 */

/** type → 显示用 i18n key；没有 key 的类型用 FIXED_LABELS（专有名词不翻译） */
export const NODE_LABEL_KEYS: Record<string, string> = {
  start: 'aiAppDesign.nodeStart',
  end: 'aiAppDesign.nodeEnd',
  switch: 'aiAppDesign.nodeSwitch',
  llm: 'aiAppDesign.nodeLlm',
  rag: 'aiAppDesign.knowledge',
  question: 'aiAppDesign.nodeQuestion',
  extract: 'aiAppDesign.nodeExtract',
  optimize: 'aiAppDesign.nodeOptimize',
  db: 'aiAppDesign.nodeDb',
  code: 'aiAppDesign.nodeCode',
  text: 'aiAppDesign.nodeText',
  updateVar: 'aiAppDesign.nodeUpdateVar',
  notice: 'aiAppDesign.nodeNotice'
}

export const FIXED_LABELS: Record<string, string> = { http: 'HTTP', mcp: 'MCP' }

/** 历史版本拖入节点时写进 DSL 的默认中文名 */
export const LEGACY_DEFAULT_LABELS: Record<string, string> = {
  start: '开始',
  end: '结束',
  switch: '分支',
  llm: '大模型',
  rag: '知识库',
  question: '问题分类',
  extract: '信息提取',
  optimize: '内容优化',
  db: '数据库',
  code: '代码',
  text: '文本',
  updateVar: '变量更新',
  http: 'HTTP',
  mcp: 'MCP',
  notice: '通知'
}

/** 「运行」按钮发给模型的固定测试输入，不跟界面语言变 */
export const RUN_SAMPLE_INPUT = '你好'

/** 存储用：默认名（空或历史默认中文名）一律存空，其余原样 */
export function storedLabel(type: string | undefined, label: unknown): string {
  const l = typeof label === 'string' ? label.trim() : ''
  if (!l) return ''
  if (type && LEGACY_DEFAULT_LABELS[type] === l) return ''
  return typeof label === 'string' ? label : ''
}

/** 显示用：用户改过名的显示原名，否则按 type 实时翻译 */
export function displayLabel(
  type: string | undefined,
  label: unknown,
  t: (key: string) => string
): string {
  const s = storedLabel(type, label)
  if (s) return s
  const key = type ? NODE_LABEL_KEYS[type] : undefined
  if (key) return t(key)
  return (type && FIXED_LABELS[type]) || type || ''
}
