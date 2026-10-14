/**
 * 内容生成发给模型的文本（pc#47 复审）：不跟界面语言变。
 * - 下拉取值是固定 key，只在显示时走 $t；发送时映射成固定中文描述。
 * - 行格式与后端 AiGenController.buildPrompt 一致：「标签: 值」逐行，尺寸「尺寸: 宽x高」，
 *   末行「请按 {type} 类型输出可用结果。」；值先 trim，空值不发。
 * - 主题、标题与后端一致，有值就各发一行（不按类型二选一）。
 * - 尺寸：宽高都有才发「尺寸: 宽x高」；只有一边时只发那一边（「宽: 800」/「高: 600」），
 *   不拼出 undefined（后端模板在这种情况会拼出 null，前端不沿用）。
 * - 唯一随界面语言变化的是「输出语言: 简体中文|English」一行。
 * - 用户自己填写的内容原样发送。
 */

export interface GenOption {
  key: string
  /** 显示用 i18n key */
  i18n: string
  /** 发给模型的固定中文描述 */
  zh: string
}

const opt = (key: string, i18n: string, zh: string): GenOption => ({ key, i18n, zh })

export const POSTER_STYLES: GenOption[] = [
  opt('redParty', 'aiGen.styleRedParty', '红色党政风'),
  opt('govElegant', 'aiGen.styleGovElegant', '淡雅政务风'),
  opt('neoExpressionism', 'aiGen.styleNeoExpressionism', '新表现主义'),
  opt('pop', 'aiGen.stylePop', '波普艺术'),
  opt('surrealCollage', 'aiGen.styleSurrealCollage', '超现实主义数字拼贴'),
  opt('minimalism', 'aiGen.styleMinimalism', '极简主义'),
  opt('boldModern', 'aiGen.styleBoldModern', '大胆现代'),
  opt('swissDecon', 'aiGen.styleSwissDecon', '瑞士国际主义解构'),
  opt('japaneseMinimal', 'aiGen.styleJapaneseMinimal', '日式极简'),
  opt('scandinavian', 'aiGen.styleScandinavian', '斯堪的纳维亚'),
  opt('elegantRetro', 'aiGen.styleElegantRetro', '优雅复古'),
  opt('cyberpunk', 'aiGen.styleCyberpunk', '赛博朋克'),
  opt('neoFuturism', 'aiGen.styleNeoFuturism', '新未来主义'),
  opt('futureTech', 'aiGen.styleFutureTech', '未来科技'),
  opt('guochao', 'aiGen.styleGuochao', '国潮东方')
]

export const PRODUCT_CATEGORIES: GenOption[] = [
  opt('electronics', 'aiGen.catElectronics', '电子产品'),
  opt('home', 'aiGen.catHome', '家居用品'),
  opt('apparel', 'aiGen.catApparel', '服装鞋帽'),
  opt('beauty', 'aiGen.catBeauty', '美妆护肤'),
  opt('food', 'aiGen.catFood', '食品饮料'),
  opt('baby', 'aiGen.catBaby', '母婴用品'),
  opt('sports', 'aiGen.catSports', '运动户外'),
  opt('digital', 'aiGen.catDigital', '数码配件'),
  opt('office', 'aiGen.catOffice', '办公用品'),
  opt('health', 'aiGen.catHealth', '健康保健'),
  opt('auto', 'aiGen.catAuto', '汽车用品'),
  opt('books', 'aiGen.catBooks', '图书音像'),
  opt('pet', 'aiGen.catPet', '宠物用品'),
  opt('toys', 'aiGen.catToys', '玩具游戏'),
  opt('software', 'aiGen.catSoftware', '软件服务')
]

const zhOf = (list: GenOption[], v: string) => list.find((o) => o.key === v)?.zh ?? v

export interface GenForm {
  topic: string
  title: string
  subtitle: string
  style: string
  category: string
  extra: string
  width?: number
  height?: number
}

/** 发给后端/模型的风格：海报下拉取 key → 固定中文；其他类型是用户自填，原样 */
export function styleForModel(type: string, style: string): string {
  return type === 'poster' ? zhOf(POSTER_STYLES, style) : style
}

/** 发给后端/模型的类目：key → 固定中文；未知值原样 */
export function categoryForModel(category: string): string {
  return zhOf(PRODUCT_CATEGORIES, category)
}

function line(label: string, v: unknown): string {
  const s = v == null ? '' : String(v).trim()
  return s ? `${label}: ${s}` : ''
}

/** 界面 locale → 发给模型的输出语言描述 */
export function outputLanguage(locale: string): string {
  return /^zh/i.test(locale || '') ? '简体中文' : 'English'
}

function sizeLines(w?: number, h?: number): string[] {
  const ok = (v?: number) => v != null && String(v).trim() !== '' && !Number.isNaN(Number(v))
  if (ok(w) && ok(h)) return [`尺寸: ${w}x${h}`]
  return [ok(w) ? `宽: ${w}` : '', ok(h) ? `高: ${h}` : '']
}

/** 拼提示词：标签与后端 buildPrompt 模板一致，固定中文 */
export function buildGenPrompt(type: string, form: GenForm, locale: string): string {
  const parts = [
    line('主题', form.topic),
    line('标题', form.title),
    line('副标题', form.subtitle),
    line('风格', styleForModel(type, form.style)),
    line('类目', categoryForModel(form.category)),
    line('补充', form.extra),
    ...sizeLines(form.width, form.height),
    `输出语言: ${outputLanguage(locale)}`,
    `请按 ${type} 类型输出可用结果。`
  ]
  return parts.filter(Boolean).join('\n')
}
