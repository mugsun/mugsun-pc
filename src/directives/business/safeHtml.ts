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
 * 链接的“新窗口打开”：DOMPurify 默认会去掉 target，编辑器里设了新窗口打开的链接，在阅读窗口里
 * 一点就把整个系统页面换成了链接的内容。这里只留 a 上的 target="_blank"，并且一定带上
 * rel="noopener noreferrer"（新开的页面拿不到 window.opener）；其他 target 一律去掉，没设的链接
 * 照旧在当前页打开。和服务端保存正文时的规则一样（mugsun-boot 的 RichTextSanitizer）。
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

// 单独的实例：下面的钩子只管这个指令，别处直接用 DOMPurify 的地方（AI 对话、代码生成预览）不受影响
const purifier = DOMPurify(window)

// 用 afterSanitizeAttributes 钩子处理 target，是 DOMPurify 官方示例的做法：
// https://github.com/cure53/DOMPurify/blob/main/demos/hooks-target-blank-demo.html
// 示例是把所有链接都改成新窗口打开；这里只保留作者自己设的 _blank，站内链接还要在当前页跳
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (!node.hasAttribute('target')) return
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  } else {
    node.removeAttribute('target')
  }
})

const render = (el: HTMLElement, value: unknown): void => {
  el.innerHTML = purifier.sanitize(value == null ? '' : String(value), { ADD_ATTR: ['target'] })
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
