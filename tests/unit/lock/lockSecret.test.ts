import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LOCK_SALT_BYTES,
  __peekLockSecretForTest,
  clearLockSecret,
  hasLockSecret,
  setLockSecret,
  verifyAndClearLockSecret
} from '@/utils/lock/lockSecret'

afterEach(() => {
  clearLockSecret()
  vi.restoreAllMocks()
})

describe('lockSecret', () => {
  it('盐至少 16 字节，且每次锁屏用 getRandomValues 重新生成', async () => {
    const spy = vi.spyOn(crypto, 'getRandomValues')
    await setLockSecret('pw-1')
    const a = __peekLockSecretForTest()!
    expect(LOCK_SALT_BYTES).toBeGreaterThanOrEqual(16)
    expect(a.salt.length).toBeGreaterThanOrEqual(16)
    expect(a.hash.length).toBe(32)
    const saltA = Array.from(a.salt)
    await setLockSecret('pw-1')
    const b = __peekLockSecretForTest()!
    expect(spy).toHaveBeenCalledTimes(2)
    expect(Array.from(b.salt)).not.toEqual(saltA)
  })

  it('hash 用 crypto.subtle 计算，内存里不保留明文', async () => {
    const spy = vi.spyOn(crypto.subtle, 'digest')
    const pw = 'my-plain-lock-pw'
    await setLockSecret(pw)
    expect(spy).toHaveBeenCalledWith('SHA-256', expect.anything())
    const s = __peekLockSecretForTest()!
    const asText = new TextDecoder().decode(new Uint8Array([...s.salt, ...s.hash]))
    expect(asText).not.toContain(pw)
    expect(Object.keys(s).sort()).toEqual(['hash', 'salt'])
  })

  it('密码错误时返回 false 且保留校验值', async () => {
    await setLockSecret('right')
    expect(await verifyAndClearLockSecret('wrong')).toBe(false)
    expect(hasLockSecret()).toBe(true)
  })

  it('解锁成功后 hash 和盐一起清掉', async () => {
    await setLockSecret('right')
    const s = __peekLockSecretForTest()!
    expect(await verifyAndClearLockSecret('right')).toBe(true)
    expect(hasLockSecret()).toBe(false)
    expect(Array.from(s.salt).every((x) => x === 0)).toBe(true)
    expect(Array.from(s.hash).every((x) => x === 0)).toBe(true)
    expect(await verifyAndClearLockSecret('right')).toBe(false)
  })

  it('未锁屏时解锁返回 false', async () => {
    expect(await verifyAndClearLockSecret('x')).toBe(false)
  })

  it('不写入 localStorage / sessionStorage', async () => {
    localStorage.clear()
    sessionStorage.clear()
    await setLockSecret('pw')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
