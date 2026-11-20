import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ElButton, ElSwitch } from 'element-plus'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  KB_SEGMENT_EDIT_PERM,
  kbSegmentColumns
} from '../../../modules/ai/views/knowledge/kbSegmentColumns'

const t = (k: string) => k
const statusTag = () => ({ type: 'success' as const, label: 'ok' })
const row = { id: 7, seq: 1, content: '第一段', enabled: 1, vectorStatus: 'success' }

function build(canEdit: boolean) {
  const onToggle = vi.fn()
  const onEdit = vi.fn()
  const cols = kbSegmentColumns({ t, canEdit, statusTag, onToggle, onEdit })
  const cell = (prop: string) => cols.find((c) => c.prop === prop)!.formatter!(row)
  return { cols, cell, onToggle, onEdit }
}

describe('知识库分段表格：没有编辑分段权限只能看', () => {
  it('权限码和后端接口查的是同一个', () => {
    expect(KB_SEGMENT_EDIT_PERM).toBe('ai:kb-seg:edit')
  })

  it('没有权限：没有操作列，启用开关照常显示状态但不能点', () => {
    const { cols, cell, onToggle } = build(false)
    expect(cols.map((c) => c.prop)).toEqual([
      'seq',
      'content',
      'tokenCount',
      'vectorStatus',
      'enabled'
    ])

    const sw = cell('enabled')
    expect(sw.type).toBe(ElSwitch)
    expect(sw.props.modelValue).toBe(true)
    expect(sw.props.disabled).toBe(true)
    sw.props['onUpdate:modelValue'](false)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('有权限：开关能点，操作列里有编辑按钮', () => {
    const { cols, cell, onToggle, onEdit } = build(true)
    expect(cols.map((c) => c.prop)).toEqual([
      'seq',
      'content',
      'tokenCount',
      'vectorStatus',
      'enabled',
      'operation'
    ])

    const sw = cell('enabled')
    expect(sw.props.disabled).toBe(false)
    sw.props['onUpdate:modelValue'](false)
    expect(onToggle).toHaveBeenLastCalledWith(row, false)
    sw.props['onUpdate:modelValue'](1)
    expect(onToggle).toHaveBeenLastCalledWith(row, true)

    const btn = cell('operation')
    expect(btn.type).toBe(ElButton)
    btn.props.onClick()
    expect(onEdit).toHaveBeenCalledWith(row)
  })

  it('详情页按这个权限决定能不能改，没有权限时提示里不再提编辑', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../modules/ai/views/knowledge/detail.vue'),
      'utf-8'
    )
    expect(src).toContain('const canEditSeg = computed(() => hasPerm(KB_SEGMENT_EDIT_PERM))')
    expect(src).toContain('canEdit: canEditSeg.value')
    expect(src).toContain("canEditSeg ? 'aiKbDetail.segHint' : 'aiKbDetail.segCount'")
    expect(zh.aiKbDetail.segCount).toBe('共 {n} 段')
    expect(en.aiKbDetail.segCount).toBe('{n} segments')
  })
})
