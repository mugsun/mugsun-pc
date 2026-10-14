import type { FormItemRule } from 'element-plus'
import { $t } from '@/locales'

/**
 * AI 中心表单统一的必填规则：字段下方红字提示、不发请求（UX-006 / UX-014）。
 * 文案走 i18n（formRules.requiredInput / requiredSelect）：输入类「请输入 X」，选择类「请选择 X」。
 * message 用函数，切换语言后再次校验即显示新语言。
 */
export function requiredRule(label: string, select = false): FormItemRule[] {
  return [
    select
      ? {
          required: true,
          message: () => $t('formRules.requiredSelect', { label }),
          trigger: 'change'
        }
      : {
          required: true,
          whitespace: true,
          message: () => $t('formRules.requiredInput', { label }),
          trigger: 'blur'
        }
  ]
}
