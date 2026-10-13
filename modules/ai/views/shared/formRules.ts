import type { FormItemRule } from 'element-plus'

/**
 * AI 中心表单统一的必填规则：字段下方红字提示、不发请求（UX-006 / UX-014）。
 * 文案与系统管理一致：输入类「请输入 X」，选择类「请选择 X」。
 */
export function requiredRule(label: string, select = false): FormItemRule[] {
  return [
    select
      ? { required: true, message: `请选择${label}`, trigger: 'change' }
      : { required: true, whitespace: true, message: `请输入${label}`, trigger: 'blur' }
  ]
}
