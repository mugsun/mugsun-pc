import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, resolveDirective, withDirectives, type App } from 'vue'
import { RICH_TEXT_VIEW_CLASS, setupSafeHtmlDirective } from '@/directives/business/safeHtml'

/**
 * v-safe-html：公告、站内信、帮助文档的正文都经它显示。
 * 1. 净化：脚本、事件属性留不下来；
 * 2. 阅读样式：容器带上 rich-text-view（样式见 rich-text-view-style.test.ts），
 *    容器自己的类、之后的更新都不能把它弄丢。
 */
type State = { html: unknown; cls?: string }

let app: App | null = null
let host: HTMLElement | null = null

function mount(state: State): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({
    render: () =>
      withDirectives(h('div', { class: ['notice-content', state.cls] }), [
        [resolveDirective('safe-html')!, state.html]
      ])
  })
  setupSafeHtmlDirective(app)
  app.mount(host)
  return host.firstElementChild as HTMLElement
}

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = null
  host = null
})

describe('v-safe-html 净化', () => {
  it('脚本和事件属性留不下来，正常的格式留着', () => {
    const el = mount(
      reactive({
        html:
          '<h1>标题</h1><p onclick="steal()">正文<script>steal()</script>' +
          '<img src="/a.png" onerror="steal()"><a href="javascript:steal()">链接</a></p>'
      })
    )

    expect(el.innerHTML).not.toContain('steal')
    expect(el.querySelector('script')).toBeNull()
    expect(el.querySelector('h1')?.textContent).toBe('标题')
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/a.png')
    expect(el.querySelector('a')?.textContent).toBe('链接')
  })

  it.each([null, undefined])('值是 %s 时显示成空', (value) => {
    const el = mount(reactive({ html: value }))

    expect(el.innerHTML).toBe('')
  })
})

describe('v-safe-html 给容器套上阅读样式', () => {
  it('挂载后带上 rich-text-view，容器自己的类还在', () => {
    const el = mount(reactive({ html: '<p>正文</p>' }))

    expect(el.classList.contains(RICH_TEXT_VIEW_CLASS)).toBe(true)
    expect(el.classList.contains('notice-content')).toBe(true)
  })

  it('正文换了，类还在', async () => {
    const state = reactive<State>({ html: '<p>第一版</p>' })
    const el = mount(state)

    state.html = '<h2>第二版</h2>'
    await nextTick()

    expect(el.querySelector('h2')?.textContent).toBe('第二版')
    expect(el.classList.contains(RICH_TEXT_VIEW_CLASS)).toBe(true)
  })

  it('容器自己的类变了（Vue 会整个重写 class），类还在，正文不重画', async () => {
    const state = reactive<State>({ html: '<p>正文</p>', cls: 'is-unread' })
    const el = mount(state)
    const paragraph = el.querySelector('p')

    state.cls = 'is-read'
    await nextTick()

    expect(el.className.split(/\s+/).sort()).toEqual(
      ['is-read', 'notice-content', RICH_TEXT_VIEW_CLASS].sort()
    )
    expect(el.querySelector('p')).toBe(paragraph)
  })
})
