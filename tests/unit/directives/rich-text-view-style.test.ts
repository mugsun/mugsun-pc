import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, h, resolveDirective, withDirectives, type App } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'sass'
import { setupSafeHtmlDirective } from '@/directives/business/safeHtml'

/**
 * 富文本阅读样式（src/assets/styles/core/rich-text-view.scss）：
 * 1. 只管 .rich-text-view 里面，已在全局样式里登记；
 * 2. 编辑器（wangEditor 5）实际输出的各种写法，经 v-safe-html 显示出来后都套得上对应的规则；
 * 3. 纯文字正文（容器带 rich-text-view--plain）保留换行和空格。
 *
 * jsdom 不排版，这里查的是“哪条规则落在元素上、声明了什么”；显示出来的样子要在浏览器里看。
 */
const root = resolve(__dirname, '../../../')
const css = compile(resolve(root, 'src/assets/styles/core/rich-text-view.scss')).css

// wangEditor 5 实际输出的写法：嵌套列表是列表直接套列表，待办是 div 里放勾选框，代码块是 pre > code，
// 拖过大小的图片把宽高写在 style 里，视频外面包一层 div
const EDITOR_HTML = [
  '<h1>四季度库存盘点安排</h1>',
  '<p>详见<a href="https://example.com/plan" target="_blank">盘点计划</a>，口径 <code>qty &lt; 10</code></p>',
  '<h2>时间</h2>',
  '<ul><li>华东仓</li><ul><li>一号库</li><ul><li>甲区</li></ul></ul><li>华南仓</li></ul>',
  '<h3>步骤</h3>',
  '<ol><li>冻结出入库</li><ul><li>急单除外</li></ul><li>盘点</li></ol>',
  '<div data-w-e-type="todo"><input type="checkbox" disabled checked>已通知仓管</div>',
  '<blockquote>盘点期间不办理退货</blockquote>',
  '<table style="width: auto;"><tbody><tr><th>仓库</th></tr><tr><td>华东仓</td></tr></tbody></table>',
  '<hr/>',
  '<pre><code class="language-sql">select *\n  from stock</code></pre>',
  '<p style="text-align: center;"><img src="/favicon.ico" alt="" data-href="" style="width: 300.00px;height: 200.00px;"/></p>',
  '<div data-w-e-type="video" data-w-e-is-void>\n<video poster="" controls="true" width="auto" height="auto">' +
    '<source src="https://example.com/a.mp4" type="video/mp4"/></video>\n</div>'
].join('')

type Declared = { value: string; important: boolean }

let styleEl: HTMLStyleElement
let rules: CSSStyleRule[] = []
let app: App
let host: HTMLElement
let view: HTMLElement

/** 样式表里最后落在元素上的声明：表内规则按“后面的盖前面的”排，带 !important 的优先 */
function declared(el: Element, prop: string): Declared {
  let found: Declared = { value: '', important: false }
  for (const rule of rules) {
    if (!el.matches(rule.selectorText)) continue
    const value = rule.style.getPropertyValue(prop)
    if (!value) continue
    const important = rule.style.getPropertyPriority(prop) === 'important'
    if (important || !found.important) found = { value, important }
  }
  return found
}

const value = (el: Element, prop: string): string => declared(el, prop).value

/** 取正文里的元素；选择器相对正文容器写，:scope 就是容器自己 */
function q(selector: string): HTMLElement {
  const el = view.querySelector<HTMLElement>(selector)
  expect(el, `正文里找不到 ${selector}`).not.toBeNull()
  return el!
}

/** 按最外层的逗号拆选择器，:is(ul, ol) 括号里的逗号不算 */
function splitSelectors(selectorText: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of selectorText) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current.trim())
  return out
}

beforeAll(() => {
  styleEl = document.createElement('style')
  styleEl.textContent = css
  document.head.appendChild(styleEl)
  rules = Array.from(styleEl.sheet!.cssRules).filter(
    (rule): rule is CSSStyleRule => 'selectorText' in rule
  )

  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({
    render: () =>
      withDirectives(h('div', { class: 'notice-content' }), [
        [resolveDirective('safe-html')!, EDITOR_HTML]
      ])
  })
  setupSafeHtmlDirective(app)
  app.mount(host)
  view = host.firstElementChild as HTMLElement
})

afterAll(() => {
  app.unmount()
  host.remove()
  styleEl.remove()
})

describe('富文本阅读样式：只管阅读区域', () => {
  it('已在全局样式 index.scss 里登记', () => {
    const index = readFileSync(resolve(root, 'src/assets/styles/index.scss'), 'utf8')

    expect(index).toMatch(/^@use '\.\/core\/rich-text-view\.scss';$/m)
  })

  it('每条规则都限定在 .rich-text-view 里面，改不到页面其他地方', () => {
    const outside = rules
      .flatMap((rule) => splitSelectors(rule.selectorText))
      .filter((selector) => !/^\.rich-text-view(--[\w-]+)?(?![\w-])/.test(selector))

    expect(rules.length).toBeGreaterThan(0)
    expect(outside).toEqual([])
  })

  it('全是不分层的普通规则：放进 @layer 就要和 Tailwind 的 preflight 比层的先后了', () => {
    expect(css).not.toContain('@layer')
    expect(rules.length).toBe(styleEl.sheet!.cssRules.length)
  })

  it('颜色只用 Element Plus 的主题变量：浅色、深色主题都跟着变，不单独写深色覆盖', () => {
    const used = Array.from(new Set((css.match(/var\(--[\w-]+/g) ?? []).map((v) => v.slice(4))))
    const others = used.filter((name) => !name.startsWith('--el-') && name !== '--custom-radius')

    expect(used.length).toBeGreaterThan(0)
    expect(others).toEqual([])
    expect(css).not.toMatch(/\.dark\b/)
  })
})

describe('富文本阅读样式：编辑器输出的各种写法都套得上', () => {
  it('标题比正文大、加粗，级别越高越大', () => {
    const sizes = ['h1', 'h2', 'h3'].map((tag) => value(q(tag), 'font-size'))
    const [h1, h2, h3] = sizes.map((size) => parseFloat(size))

    // 用 em：跟着所在窗口的正文字号走
    expect(sizes.every((size) => /^[\d.]+em$/.test(size))).toBe(true)
    expect(h1).toBeGreaterThan(h2)
    expect(h2).toBeGreaterThan(h3)
    expect(h3).toBeGreaterThan(1)
    expect(value(q('h1'), 'font-weight')).toBe('700')
  })

  it('段落之间有间距，正文首尾不留空', () => {
    const paragraph = q(':scope > p')

    expect(parseFloat(value(paragraph, 'margin-top'))).toBeGreaterThan(0)
    expect(parseFloat(value(paragraph, 'margin-bottom'))).toBeGreaterThan(0)
    expect(parseFloat(value(q(':scope > :first-child'), 'margin-top'))).toBe(0)
    expect(parseFloat(value(q(':scope > :last-child'), 'margin-bottom'))).toBe(0)
  })

  it('无序列表有圆点、有序列表有序号，嵌套的圆点按层级换（编辑器里是 • ◦ ▪）', () => {
    expect(value(q(':scope > ul'), 'list-style-type')).toBe('disc')
    expect(value(q(':scope > ul > ul'), 'list-style-type')).toBe('circle')
    expect(value(q(':scope > ul > ul > ul'), 'list-style-type')).toBe('square')
    expect(value(q(':scope > ol'), 'list-style-type')).toBe('decimal')
    expect(value(q(':scope > ol > ul'), 'list-style-type')).toBe('circle')
    // 圆点、序号画在缩进里，缩进是 0 就看不见了
    expect(parseFloat(value(q(':scope > ul'), 'padding-left'))).toBeGreaterThan(0)
    expect(parseFloat(value(q(':scope > ol'), 'padding-left'))).toBeGreaterThan(0)
  })

  it('一百项以上的有序列表缩进更宽：三位数的序号 2em 放不下，会被正文区域的左边缘裁掉一截', () => {
    const items = (count: number): HTMLOListElement => {
      const list = document.createElement('ol')
      list.innerHTML = '<li>一项</li>'.repeat(count)
      return list
    }
    const short = items(99)
    const long = items(100)
    // 编辑器输出的嵌套列表是列表的直接子元素，不算一项：99 项加一个嵌套列表还是 99 项
    const nested = items(99)
    nested.insertBefore(document.createElement('ul'), nested.children[1])
    view.append(short, long, nested)

    try {
      const normal = value(q(':scope > ol'), 'padding-left')

      expect(value(short, 'padding-left')).toBe(normal)
      expect(value(nested, 'padding-left')).toBe(normal)
      expect(parseFloat(value(long, 'padding-left'))).toBeGreaterThan(parseFloat(normal))
      // 用 em：序号的宽度跟着字号走
      expect(value(long, 'padding-left')).toMatch(/^[\d.]+em$/)
    } finally {
      short.remove()
      long.remove()
      nested.remove()
    }
  })

  it('待办的勾选框和文字之间有间距', () => {
    const box = q('[data-w-e-type="todo"] > input[type="checkbox"]')

    expect(box.hasAttribute('disabled')).toBe(true)
    expect(parseFloat(value(box, 'margin-right'))).toBeGreaterThan(0)
  })

  it('表格有边框，表头加粗居中', () => {
    expect(value(q('td'), 'border')).toMatch(/^1px solid /)
    expect(value(q('th'), 'border')).toMatch(/^1px solid /)
    expect(value(q('table'), 'border-collapse')).toBe('collapse')
    expect(value(q('th'), 'font-weight')).toBe('700')
    expect(value(q('th'), 'text-align')).toBe('center')
    expect(value(q('td'), 'text-align')).toBe('left')
  })

  it('引用有底色和左边的竖线', () => {
    const quote = q('blockquote')

    expect(value(quote, 'border-left')).toMatch(/^4px solid /)
    expect(value(quote, 'background-color')).not.toBe('')
    expect(parseFloat(value(quote, 'padding-left'))).toBeGreaterThan(0)
  })

  it('代码块保留换行和缩进，有边框和底色；行内代码有底色，仍然跟文字排在一行', () => {
    const block = q('pre > code')
    const inline = q('p > code')

    expect(value(block, 'display')).toBe('block')
    expect(value(block, 'white-space')).toBe('pre')
    expect(value(block, 'overflow')).toBe('auto')
    expect(value(block, 'border')).toMatch(/^1px solid /)
    expect(value(block, 'background-color')).not.toBe('')
    expect(value(inline, 'background-color')).not.toBe('')
    expect(value(inline, 'display')).toBe('')
  })

  it('链接有自己的颜色，鼠标移上去有下划线', () => {
    const hover = rules.find((rule) => rule.selectorText.includes('a:hover'))

    expect(value(q('a'), 'color')).not.toBe('')
    expect(hover?.style.getPropertyValue('text-decoration')).toBe('underline')
  })

  it('分割线看得见', () => {
    const line = q('hr')

    expect(parseFloat(value(line, 'height'))).toBeGreaterThan(0)
    expect(value(line, 'background-color')).not.toBe('')
  })

  it('图片回到行内（段落设的居中才对它起作用），拖过大小的图片窄窗口里按比例缩', () => {
    const img = q('p > img')

    // 作者拖出来的固定宽高写在 style 里，样式表要盖过它的高度只能用 !important
    expect(parseFloat(img.style.height)).toBe(200)
    expect(img.parentElement?.style.textAlign).toBe('center')
    expect(value(img, 'display')).toBe('inline')
    expect(value(img, 'max-width')).toBe('100%')
    expect(declared(img, 'height')).toEqual({ value: 'auto', important: true })
  })

  it('视频回到行内并居中，不超出窗口', () => {
    const video = q('[data-w-e-type="video"] > video')

    expect(value(video.parentElement!, 'text-align')).toBe('center')
    expect(value(video, 'display')).toBe('inline')
    expect(value(video, 'max-width')).toBe('100%')
  })

  it('宽表格、长代码在正文区域里横向滚动，长串英文能折行', () => {
    expect(value(view, 'overflow-x')).toBe('auto')
    expect(value(view, 'overflow-wrap')).toBe('break-word')
  })
})

describe('富文本阅读样式：纯文字正文', () => {
  it('带 rich-text-view--plain 的容器保留换行和空格，过长的行照常折行；不带的不受影响', () => {
    const plain = document.createElement('div')
    plain.className = 'msg-content rich-text-view rich-text-view--plain'

    // pre-wrap：换行和连续空格都留着，到边界仍然自动折行（pre 不折行，pre-line 会合并空格）
    expect(value(plain, 'white-space')).toBe('pre-wrap')
    expect(value(view, 'white-space')).toBe('')
  })
})
