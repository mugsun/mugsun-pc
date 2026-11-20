import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, resolveDirective, withDirectives, type App } from 'vue'
import DOMPurify from 'dompurify'
import {
  RICH_TEXT_PLAIN_CLASS,
  RICH_TEXT_VIEW_CLASS,
  setupSafeHtmlDirective
} from '@/directives/business/safeHtml'

/**
 * v-safe-html：公告、站内信、帮助文档的正文都经它显示。
 * 1. 净化：脚本、事件属性留不下来；
 * 2. 阅读样式：容器带上 rich-text-view（样式见 rich-text-view-style.test.ts），
 *    容器自己的类、之后的更新都不能把它弄丢；
 * 3. 链接的“新窗口打开”：只认 a 上的 target="_blank"，并且一定带 rel="noopener noreferrer"；
 * 4. 纯文字正文：一个标签都没有时容器带上 rich-text-view--plain（保留换行和空格），带标签的不带。
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

describe('v-safe-html 链接的“新窗口打开”', () => {
  const LINK = '<a href="https://example.com/plan" target="_blank">盘点计划</a>'

  it('编辑器存的 target="_blank" 留着，并且一定带 rel="noopener noreferrer"', () => {
    const el = mount(
      reactive({
        html:
          `<p>${LINK}` +
          '<a href="https://example.com/b" target="_blank" rel="nofollow opener">自己写了 rel 的</a></p>'
      })
    )
    const links = Array.from(el.querySelectorAll('a'))

    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
    expect(links[0].getAttribute('href')).toBe('https://example.com/plan')
  })

  it.each(['_self', '_top', '_parent', 'main', '_BLANK', ''])(
    'target="%s" 不留：只认 _blank，和服务端保存时的规则一样',
    (target) => {
      const el = mount(
        reactive({ html: `<a href="https://example.com/a" target="${target}">链接</a>` })
      )
      const link = el.querySelector('a')

      expect(link?.hasAttribute('target')).toBe(false)
      expect(link?.getAttribute('href')).toBe('https://example.com/a')
    }
  )

  it('没设新窗口的链接不动：照旧在当前页打开', () => {
    const el = mount(reactive({ html: '<a href="/system/message">站内链接</a>' }))

    expect(el.innerHTML).toBe('<a href="/system/message">站内链接</a>')
  })

  it('别的元素上的 target 不留', () => {
    const el = mount(
      reactive({
        html:
          '<map name="nav"><area href="https://example.com/c" target="_blank" alt="区域"></map>' +
          '<svg><a href="https://example.com/d" target="_blank"><text>图里的链接</text></a></svg>'
      })
    )

    expect(el.querySelector('area')).not.toBeNull()
    expect(el.querySelector('[target]')).toBeNull()
  })

  it('只影响这个指令：别处直接用 DOMPurify 的结果不变', () => {
    mount(reactive({ html: LINK }))

    expect(DOMPurify.sanitize(LINK)).toBe('<a href="https://example.com/plan">盘点计划</a>')
  })
})

describe('v-safe-html 纯文字正文', () => {
  // 在「发送消息」的文本框里分几行写的站内信：正文里只有文字和换行
  const PLAIN = '各位同事：\n  1. 周五 18:00 停机维护\n  2. 库存 < 10 的商品请提前补货\n运维组'

  it('一个标签都没有：带上 rich-text-view--plain，文字、换行、空格原样在', () => {
    const el = mount(reactive({ html: PLAIN }))

    expect(el.classList.contains(RICH_TEXT_PLAIN_CLASS)).toBe(true)
    expect(el.classList.contains(RICH_TEXT_VIEW_CLASS)).toBe(true)
    expect(el.textContent).toBe(PLAIN)
    expect(el.firstElementChild).toBeNull()
  })

  it.each([
    ['编辑器写的', '<p>各位同事：</p><p>周五停机维护</p>'],
    ['手写的 HTML 片段', '各位同事：\n<b>周五</b>停机维护\n<br>运维组']
  ])('带标签的正文（%s）不带：仍按 HTML 的规则排', (_name, html) => {
    const el = mount(reactive({ html }))

    expect(el.classList.contains(RICH_TEXT_PLAIN_CLASS)).toBe(false)
    expect(el.classList.contains(RICH_TEXT_VIEW_CLASS)).toBe(true)
  })

  it('看的是净化以后剩下的内容：标签全被去掉的也算纯文字', () => {
    const el = mount(reactive({ html: '第一行\n<script>steal()</script>第二行' }))

    expect(el.textContent).toBe('第一行\n第二行')
    expect(el.classList.contains(RICH_TEXT_PLAIN_CLASS)).toBe(true)
  })

  it('正文换了，类跟着换', async () => {
    const state = reactive<State>({ html: PLAIN })
    const el = mount(state)

    state.html = '<p>带格式的正文</p>'
    await nextTick()
    expect(el.classList.contains(RICH_TEXT_PLAIN_CLASS)).toBe(false)

    state.html = PLAIN
    await nextTick()
    expect(el.classList.contains(RICH_TEXT_PLAIN_CLASS)).toBe(true)
  })

  it('容器自己的类变了（Vue 会整个重写 class），类还在', async () => {
    const state = reactive<State>({ html: PLAIN, cls: 'is-unread' })
    const el = mount(state)

    state.cls = 'is-read'
    await nextTick()

    expect(el.className.split(/\s+/).sort()).toEqual(
      ['is-read', 'notice-content', RICH_TEXT_VIEW_CLASS, RICH_TEXT_PLAIN_CLASS].sort()
    )
  })
})
