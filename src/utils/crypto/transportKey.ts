/**
 * 接口传输密钥零配置：登录后调 /api/crypto/bootstrap，只存内存；登出/换账号清空。
 * 构建期 VITE_CRYPTO_API_KEY 非空时与运行时字节逐字节比较，不一致则报错并禁用加密，
 * 不回落内置值、不写任何 storage、不打 console、不进埋点/错误上报。
 * 密钥只作传输混淆，不能替代 HTTPS，不得用于锁屏/本地落库/签名。
 */
import { ElMessage } from 'element-plus'
import { fetchCryptoBootstrap } from '@/api/crypto'
import { parseApiKey } from '@/utils/crypto/apiKey'
import { $t } from '@/locales'

/** 模块级内存密钥；null 表示未就绪或已禁用 */
let keyBytes: number[] | null = null
/** 是否允许用内存密钥发加密请求 */
let encryptionEnabled = false
/** 在途 bootstrap，避免并发重复请求 */
let inflight: Promise<boolean> | null = null
/** 「接口密文无效」场景下是否已用过一次刷新重试 */
let cipherInvalidRefreshUsed = false

function bytesEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function disableEncryption(message: string): false {
  keyBytes = null
  encryptionEnabled = false
  ElMessage.error(message)
  return false
}

/** 登出、401 跳登录、切换租户/账号时调用：清空内存密钥 */
export function clearTransportKey(): void {
  keyBytes = null
  encryptionEnabled = false
  inflight = null
  cipherInvalidRefreshUsed = false
}

/** 当前是否可发加密请求 */
export function isTransportEncryptionEnabled(): boolean {
  return encryptionEnabled && keyBytes != null && keyBytes.length === 16
}

/** 只读拷贝；未启用时返回 null */
export function getTransportKeyBytes(): number[] | null {
  if (!isTransportEncryptionEnabled() || !keyBytes) return null
  return keyBytes.slice()
}

/**
 * 将运行时 keyHex 写入内存，并与构建期 VITE_CRYPTO_API_KEY（若非空）逐字节比对。
 * @returns 是否启用加密
 */
function applyRuntimeKeyHex(keyHex: string): boolean {
  const runtime = parseApiKey(keyHex)
  if (!runtime.ok) {
    return disableEncryption($t('pages.system.crypto.bootstrapKeyInvalid'))
  }

  const build = parseApiKey(import.meta.env.VITE_CRYPTO_API_KEY)
  if (!build.ok) {
    if (build.error === 'invalid') {
      // 构建期非空但非法：报错禁用，不用运行时值悄悄顶替
      return disableEncryption($t('pages.system.crypto.buildKeyInvalid'))
    }
    // missing：只用运行时（推荐零配置路径）
  } else if (!bytesEqual(build.bytes, runtime.bytes)) {
    return disableEncryption($t('pages.system.crypto.keyMismatch'))
  }

  keyBytes = runtime.bytes
  encryptionEnabled = true
  return true
}

async function doBootstrap(): Promise<boolean> {
  try {
    const data = await fetchCryptoBootstrap()
    if (!data?.keyHex) {
      return disableEncryption($t('pages.system.crypto.bootstrapFailed'))
    }
    return applyRuntimeKeyHex(data.keyHex)
  } catch {
    // 401/403/429/网络：统一禁用并提示，不回落任何内置值
    return disableEncryption($t('pages.system.crypto.bootstrapFailed'))
  }
}

/**
 * 确保内存中有传输密钥。未登录时不请求。
 * 已启用则直接 true；失败时已 toast 并禁用加密。
 */
export async function ensureTransportKey(hasAuth: boolean): Promise<boolean> {
  if (!hasAuth) {
    // 未登录绝不请求 bootstrap
    clearTransportKey()
    return false
  }
  if (isTransportEncryptionEnabled()) return true
  if (inflight) return inflight
  inflight = doBootstrap().finally(() => {
    inflight = null
  })
  return inflight
}

/**
 * 「接口密文无效」时可刷新内存密钥并重试一次；整次会话只允许一次，避免死循环。
 */
export async function refreshTransportKeyOnce(hasAuth: boolean): Promise<boolean> {
  if (!hasAuth || cipherInvalidRefreshUsed) return false
  cipherInvalidRefreshUsed = true
  keyBytes = null
  encryptionEnabled = false
  return ensureTransportKey(hasAuth)
}

/** 供单测重置模块状态 */
export function __resetTransportKeyForTest(): void {
  clearTransportKey()
}
