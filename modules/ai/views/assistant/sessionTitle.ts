/**
 * 会话标题：新建时存固定中文「新对话 N」（发给后端的内容不跟界面语言变），
 * 显示时把这个默认格式按界面语言翻译；用户改过的标题原样显示。
 */
const DEFAULT_RE = /^新对话 (\d+)$/

export function newSessionTitle(n: number): string {
  return `新对话 ${n}`
}

export function displaySessionTitle(
  title: string | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (!title) return t('aiChat.newChat')
  const m = DEFAULT_RE.exec(title)
  return m ? t('aiChat.newChatN', { n: m[1] }) : title
}
