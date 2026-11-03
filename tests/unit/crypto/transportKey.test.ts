import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchCryptoBootstrap = vi.hoisted(() => vi.fn())
const elMessageError = vi.hoisted(() => vi.fn())

vi.mock('@/api/crypto', () => ({
  fetchCryptoBootstrap
}))

vi.mock('element-plus', () => ({
  ElMessage: { error: elMessageError, success: vi.fn(), warning: vi.fn() }
}))

vi.mock('@/locales', () => ({
  $t: (k: string) => k
}))

import {
  __resetTransportKeyForTest,
  clearTransportKey,
  ensureTransportKey,
  getTransportKeyBytes,
  isTransportEncryptionEnabled,
  refreshTransportKeyOnce
} from '@/utils/crypto/transportKey'

const KEY_HEX = '00112233445566778899aabbccddeeff'

describe('transportKey', () => {
  beforeEach(() => {
    __resetTransportKeyForTest()
    fetchCryptoBootstrap.mockReset()
    elMessageError.mockReset()
    vi.stubEnv('VITE_CRYPTO_API_KEY', '')
  })

  it('未登录不请求 bootstrap，且内存无密钥', async () => {
    const ok = await ensureTransportKey(false)
    expect(ok).toBe(false)
    expect(fetchCryptoBootstrap).not.toHaveBeenCalled()
    expect(getTransportKeyBytes()).toBeNull()
    expect(isTransportEncryptionEnabled()).toBe(false)
  })

  it('登录后请求一次并只存内存', async () => {
    fetchCryptoBootstrap.mockResolvedValue({
      algorithm: 'SM4-GCM',
      keyHex: KEY_HEX,
      keySource: 'configured'
    })
    const ok = await ensureTransportKey(true)
    expect(ok).toBe(true)
    expect(fetchCryptoBootstrap).toHaveBeenCalledTimes(1)
    expect(getTransportKeyBytes()).toEqual([
      0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff
    ])
    // 再次 ensure 不重复请求
    await ensureTransportKey(true)
    expect(fetchCryptoBootstrap).toHaveBeenCalledTimes(1)
  })

  it('logout 清密钥后内存为 null', async () => {
    fetchCryptoBootstrap.mockResolvedValue({
      algorithm: 'SM4-GCM',
      keyHex: KEY_HEX,
      keySource: 'auto-generated'
    })
    await ensureTransportKey(true)
    expect(isTransportEncryptionEnabled()).toBe(true)
    clearTransportKey()
    expect(getTransportKeyBytes()).toBeNull()
    expect(isTransportEncryptionEnabled()).toBe(false)
  })

  it('构建期密钥与运行时不一致则禁用且不采用任一方', async () => {
    vi.stubEnv('VITE_CRYPTO_API_KEY', 'ffeeddccbbaa99887766554433221100')
    fetchCryptoBootstrap.mockResolvedValue({
      algorithm: 'SM4-GCM',
      keyHex: KEY_HEX,
      keySource: 'configured'
    })
    const ok = await ensureTransportKey(true)
    expect(ok).toBe(false)
    expect(isTransportEncryptionEnabled()).toBe(false)
    expect(getTransportKeyBytes()).toBeNull()
    expect(elMessageError).toHaveBeenCalled()
  })

  it('构建期 hex 与运行时等值 base64 字节一致则启用', async () => {
    const bytes = KEY_HEX.match(/.{2}/g)!.map((h) => parseInt(h, 16))
    const b64 = btoa(String.fromCharCode(...bytes))
    vi.stubEnv('VITE_CRYPTO_API_KEY', b64)
    fetchCryptoBootstrap.mockResolvedValue({
      algorithm: 'SM4-GCM',
      keyHex: KEY_HEX,
      keySource: 'configured'
    })
    const ok = await ensureTransportKey(true)
    expect(ok).toBe(true)
    expect(isTransportEncryptionEnabled()).toBe(true)
  })

  it('bootstrap 失败禁用加密并提示', async () => {
    fetchCryptoBootstrap.mockRejectedValue(new Error('network'))
    const ok = await ensureTransportKey(true)
    expect(ok).toBe(false)
    expect(isTransportEncryptionEnabled()).toBe(false)
    expect(elMessageError).toHaveBeenCalled()
  })

  it('refreshTransportKeyOnce 只允许一次', async () => {
    fetchCryptoBootstrap.mockResolvedValue({
      algorithm: 'SM4-GCM',
      keyHex: KEY_HEX,
      keySource: 'configured'
    })
    await ensureTransportKey(true)
    fetchCryptoBootstrap.mockClear()
    expect(await refreshTransportKeyOnce(true)).toBe(true)
    expect(fetchCryptoBootstrap).toHaveBeenCalledTimes(1)
    fetchCryptoBootstrap.mockClear()
    expect(await refreshTransportKeyOnce(true)).toBe(false)
    expect(fetchCryptoBootstrap).not.toHaveBeenCalled()
  })
})
