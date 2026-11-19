import { afterEach, describe, expect, it, vi } from 'vitest'
import { rememberSocialFlow, takeSocialFlow } from '@/utils/security/socialFlow'

const authorizeUrl = (state: string) =>
  `http://192.168.56.101:8088/api/auth/social/mock-authorize?response_type=code&client_id=x&state=${state}`

describe('socialFlow：回调页只认本标签页发起的授权', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.useRealTimers()
  })

  it('本标签页发起的绑定：来源和 state 对上才返回用途，而且只能取一次', () => {
    rememberSocialFlow('bind', 'mock', authorizeUrl('s1'))
    expect(takeSocialFlow('mock', 's1')).toBe('bind')
    expect(takeSocialFlow('mock', 's1')).toBeNull()
  })

  it('别人发来的回调（没有记录、state 或来源对不上）返回 null，并清掉记录', () => {
    expect(takeSocialFlow('mock', 's1')).toBeNull()

    rememberSocialFlow('login', 'mock', authorizeUrl('mine'))
    expect(takeSocialFlow('mock', 'attacker')).toBeNull()
    expect(takeSocialFlow('mock', 'mine')).toBeNull()

    rememberSocialFlow('login', 'github', authorizeUrl('s2'))
    expect(takeSocialFlow('mock', 's2')).toBeNull()
  })

  it('超过 10 分钟的记录作废', () => {
    vi.useFakeTimers()
    rememberSocialFlow('login', 'mock', authorizeUrl('s1'))
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(takeSocialFlow('mock', 's1')).toBeNull()
  })

  it('授权地址里没有 state 时不留记录', () => {
    rememberSocialFlow('bind', 'mock', 'https://idp.test/authorize?client_id=x')
    expect(sessionStorage.length).toBe(0)
  })
})
