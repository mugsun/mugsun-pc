import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

const read = (file: string) => readFileSync(resolve(__dirname, '../../../', file), 'utf-8')

describe('密钥留空的提示：改了地址要重新填', () => {
  it('AI 表单的留空提示说明了改地址要重填', () => {
    expect(zh.aiForm.phKeepUnchanged).toBe('编辑时留空表示不修改；改了地址要重新填')
    expect(en.aiForm.phKeepUnchanged).toBe(
      'Leave blank to keep it; re-enter if the address changes'
    )
  })

  it('模型的两个密钥、MCP 的密钥、AI 数据源的密码都带这条提示', () => {
    expect(read('modules/ai/views/model/index.vue').match(/aiForm\.phKeepUnchanged/g)).toHaveLength(
      2
    )
    expect(read('modules/ai/views/mcp/index.vue')).toContain(
      "form.id ? $t('aiForm.phKeepUnchanged') : ''"
    )
    expect(read('modules/ai/views/datasource/index.vue')).toContain("$t('aiForm.phKeepUnchanged')")
  })

  it('代码生成数据源：编辑时的口令提示说明了改地址要重填，新增时的必填提示单独一条', () => {
    const zhPack = zh.pages.system.genDatasource
    const enPack = en.pages.system.genDatasource
    expect(zhPack.passwordPlaceholder).toBe('保存后不再显示')
    expect(enPack.passwordPlaceholder).toBe('Not shown again after saving')
    expect(zhPack.passwordKeepPlaceholder).toBe('留空沿用原来的；改了连接地址要重新填')
    expect(enPack.passwordKeepPlaceholder).toBe(
      'Leave blank to keep it; re-enter if the URL changes'
    )
    expect(zhPack.passwordRequired).toBe('请填写数据库口令')
    expect(enPack.passwordRequired).toBe('Enter the database password')

    const view = read('src/views/system/gen-datasource/index.vue')
    expect(view).toMatch(
      /form\.id\s*\?\s*\$t\('pages\.system\.genDatasource\.passwordKeepPlaceholder'\)\s*:\s*\$t\('pages\.system\.genDatasource\.passwordPlaceholder'\)/
    )
    expect(view).toContain("t('pages.system.genDatasource.passwordRequired')")
  })

  // 输入框里放不下的占位文字只显示前半句。1284 宽的窗口里实测：用 aiForm.phKeepUnchanged 的输入框
  // 最窄 457px（AI 数据源），代码生成数据源的口令输入框 370px；14px 字号下中文一个字 14px，英文平均 6.6px
  it('占位文字放得进输入框', () => {
    const width = (text: string) =>
      Array.from(text).reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e7f ? 14 : 6.6), 0)
    for (const pack of [zh, en]) {
      expect(width(pack.aiForm.phKeepUnchanged)).toBeLessThanOrEqual(457)
      expect(width(pack.pages.system.genDatasource.passwordPlaceholder)).toBeLessThanOrEqual(370)
      expect(width(pack.pages.system.genDatasource.passwordKeepPlaceholder)).toBeLessThanOrEqual(
        370
      )
    }
  })
})
