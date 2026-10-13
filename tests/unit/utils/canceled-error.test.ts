import { describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))

import { HttpError } from '@/utils/http/error'
import { isCanceledError } from '@/utils/sys/error-handle'

describe('isCanceledError（设计器等页「请求已取消」不再当未捕获错误）', () => {
  it('请求层取消的 HttpError、axios CanceledError、useTable 中断都算取消', () => {
    expect(isCanceledError(new HttpError('请求已取消', 500, { canceled: true }))).toBe(true)
    expect(isCanceledError({ name: 'CanceledError', code: 'ERR_CANCELED' })).toBe(true)
    expect(isCanceledError({ __CANCEL__: true })).toBe(true)
    expect(isCanceledError(new Error('请求已取消'))).toBe(true)
  })
  it('普通错误与业务 HttpError 不算', () => {
    expect(isCanceledError(new Error('boom'))).toBe(false)
    expect(isCanceledError(new HttpError('请填写名称', 400))).toBe(false)
    expect(isCanceledError(undefined)).toBe(false)
  })
})
