import DOMPurify from 'dompurify'
import hljs from 'highlight.js'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 轻量 Markdown：代码块高亮 + 换行。完整页面和抽屉共用。
 * copyLabel 有值时，每个代码块右上角加一个复制按钮（由调用方用事件委托处理点击）。
 */
export function renderMarkdown(text?: string, copyLabel?: string): string {
  let html = escapeHtml(text || '')
  // 吃掉代码块前后的换行，避免块级元素旁多出空行
  html = html.replace(/\n*```(\w*)\n([\s\S]*?)```\n*/g, (_m, lang: string, code: string) => {
    // code 已经转义过，高亮前还原，避免 &amp;lt; 双重转义
    const rawCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    let body: string
    try {
      body =
        lang && hljs.getLanguage(lang)
          ? hljs.highlight(rawCode, { language: lang }).value
          : hljs.highlightAuto(rawCode).value
    } catch {
      body = code
    }
    const pre = `<pre><code class="hljs">${body.replace(/\n/g, '&#10;')}</code></pre>`
    if (!copyLabel) return pre
    return `<div class="ai-code"><button type="button" class="ai-code__copy" data-ai-copy="1">${escapeHtml(copyLabel)}</button>${pre}</div>`
  })
  html = html.replace(/\n/g, '<br/>')
  return DOMPurify.sanitize(html)
}
