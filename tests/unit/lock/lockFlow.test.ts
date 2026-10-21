import { describe, expect, it, vi } from 'vitest'
import { lockFlow, unlockFlow } from '@/utils/lock/lockFlow'

describe('lockFlow', () => {
  it('调用 setSecret 时 form.password 已清空，并收到原明文', async () => {
    const form = { password: 'p@ss' }
    const setSecret = vi.fn(async (pw: string) => {
      expect(form.password).toBe('')
      expect(pw).toBe('p@ss')
    })
    await expect(lockFlow(form, setSecret)).resolves.toBe(true)
    expect(setSecret).toHaveBeenCalledOnce()
  })

  it('setSecret 抛错时返回 false，明文也已清空', async () => {
    const form = { password: 'p@ss' }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      lockFlow(form, async () => {
        throw new Error('subtle unavailable')
      })
    ).resolves.toBe(false)
    expect(form.password).toBe('')
  })
})

describe('unlockFlow', () => {
  it('调用 verify 时 form.password 已清空，并返回 verify 结果', async () => {
    const form = { password: 'p@ss' }
    const verify = vi.fn(async (pw: string) => {
      expect(form.password).toBe('')
      return pw === 'p@ss'
    })
    await expect(unlockFlow(form, verify)).resolves.toBe(true)
    form.password = 'wrong'
    await expect(unlockFlow(form, verify)).resolves.toBe(false)
  })
})
