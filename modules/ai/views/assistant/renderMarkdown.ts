import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import './renderMarkdown.scss'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 轻量 Markdown：代码块高亮 + 换行。完整页面和抽屉共用。
 * copyLabel 有值时，代码块顶部加 28px 头栏：左边语言名，右边复制按钮；
 * 代码区单独横向滚动，复制按钮不会压在代码上。点击由 handleCodeCopy 事件委托处理。
 */
export function renderMarkdown(text?: string, copyLabel?: string): string {
  let html = escapeHtml(text || '')
  // 吃掉代码块前后的换行，避免块级元素旁多出空行
  html = html.replace(/\n*```(\w*)\n([\s\S]*?)```\n*/g, (_m, lang: string, code: string) => {
    // code 已经转义过，高亮前还原，避免 &amp;lt; 双重转义
    const rawCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    let body: string
    let langName = lang
    try {
      if (lang && hljs.getLanguage(lang)) {
        body = hljs.highlight(rawCode, { language: lang }).value
      } else {
        const auto = hljs.highlightAuto(rawCode)
        body = auto.value
        langName = lang || auto.language || ''
      }
    } catch {
      body = code
    }
    const pre = `<pre class="ai-code__body"><code class="hljs">${body.replace(/\n/g, '&#10;')}</code></pre>`
    if (!copyLabel) return pre
    return (
      `<div class="ai-code"><div class="ai-code__hd"><span class="ai-code__lang">${escapeHtml(langName || 'code')}</span>` +
      `<button type="button" class="ai-code__copy" data-ai-copy="1">${escapeHtml(copyLabel)}</button></div>${pre}</div>`
    )
  })
  html = html.replace(/\n/g, '<br/>')
  return DOMPurify.sanitize(html)
}

/** 代码块复制（事件委托）：复制后按钮变成「已复制」，1.5 秒后还原 */
export async function handleCodeCopy(
  e: MouseEvent,
  copy: (text: string) => Promise<void> | void,
  copyText: string,
  copiedText: string
): Promise<boolean> {
  const btn = (e.target as HTMLElement | null)?.closest?.('[data-ai-copy]') as HTMLElement | null
  if (!btn) return false
  const code = btn.closest('.ai-code')?.querySelector('pre')?.textContent || ''
  await copy(code)
  btn.textContent = copiedText
  btn.classList.add('is-copied')
  setTimeout(() => {
    btn.textContent = copyText
    btn.classList.remove('is-copied')
  }, 1500)
  return true
}
