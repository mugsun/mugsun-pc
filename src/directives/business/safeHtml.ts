/**
 * v-safe-html 富文本安全渲染指令
 *
 * 统一入口：所有富文本渲染经 DOMPurify 净化后再写入 innerHTML，防存储型 XSS
 * （替代各页面局部散写 DOMPurify.sanitize 的重复逻辑）。
 *
 * 指令同时给容器加上 rich-text-view：编辑器输出的 HTML 不带样式，阅读样式（标题、列表、
 * 表格等，和编辑器里看到的一致）在 @styles/core/rich-text-view.scss，用了指令就有，
 * 不用每个页面各写一份。
 *
 * ## 使用示例
 * ```vue
 * <div v-safe-html="notice.content"></div>
 * ```
 */
import DOMPurify from 'dompurify'
import type { App, Directive } from 'vue'

/** 阅读样式挂在这个类上，见 @styles/core/rich-text-view.scss */
export const RICH_TEXT_VIEW_CLASS = 'rich-text-view'

const mark = (el: HTMLElement): void => {
  el.classList.add(RICH_TEXT_VIEW_CLASS)
}

const render = (el: HTMLElement, value: unknown): void => {
  el.innerHTML = DOMPurify.sanitize(value == null ? '' : String(value))
  mark(el)
}

const safeHtmlDirective: Directive<HTMLElement, unknown> = {
  mounted(el, binding) {
    render(el, binding.value)
  },
  updated(el, binding) {
    if (binding.value !== binding.oldValue) {
      render(el, binding.value)
    } else {
      // 容器自己的 class 绑定变了时，Vue 会整个重写 className，这里把类补回去
      mark(el)
    }
  }
}

export function setupSafeHtmlDirective(app: App): void {
  app.directive('safe-html', safeHtmlDirective)
}

export type SafeHtmlDirective = typeof safeHtmlDirective
