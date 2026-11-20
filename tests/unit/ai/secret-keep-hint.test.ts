import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

const read = (file: string) => readFileSync(resolve(__dirname, '../../../', file), 'utf-8')

describe('密钥留空的提示：改了地址要重新填', () => {
  it('AI 表单的留空提示说明了改地址要重填', () => {
    expect(zh.aiForm.phKeepUnchanged).toBe('编辑时留空表示不修改；改了地址要重新填')
    expect(en.aiForm.phKeepUnchanged).toContain('re-enter it if the address changes')
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

  it('代码生成数据源：口令提示说明了改地址要重填，新增时的必填提示单独一条', () => {
    const zhPack = zh.pages.system.genDatasource
    const enPack = en.pages.system.genDatasource
    expect(zhPack.passwordPlaceholder).toContain('改了连接地址要重新填')
    expect(enPack.passwordPlaceholder).toContain('re-enter it if the connection URL changes')
    expect(zhPack.passwordRequired).toBe('请填写数据库口令')
    expect(enPack.passwordRequired).toBe('Enter the database password')

    const view = read('src/views/system/gen-datasource/index.vue')
    expect(view).toContain("$t('pages.system.genDatasource.passwordPlaceholder')")
    expect(view).toContain("t('pages.system.genDatasource.passwordRequired')")
  })
})
