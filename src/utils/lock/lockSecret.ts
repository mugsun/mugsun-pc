/**
 * 锁屏密码的内存校验值：只保存加盐 SHA-256 hash 和盐，不保存明文。
 *
 * - 盐每次锁屏用 crypto.getRandomValues 生成 16 字节，hash 用 crypto.subtle 计算
 * - 只存在本模块的内存变量里，不写 localStorage / sessionStorage，也不进 pinia 持久化状态
 * - 解锁成功后 hash 和盐一起清掉；登出时也清掉
 *
 * 锁屏只是遮挡界面，不是安全边界：解锁是纯前端比对，刷新页面就会解锁。
 */
export const LOCK_SALT_BYTES = 16

interface LockSecret {
  salt: Uint8Array
  hash: Uint8Array
}

let secret: LockSecret | null = null

async function digest(salt: Uint8Array, password: string): Promise<Uint8Array> {
  const pw = new TextEncoder().encode(password)
  const buf = new Uint8Array(salt.length + pw.length)
  buf.set(salt)
  buf.set(pw, salt.length)
  const out = new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
  buf.fill(0)
  pw.fill(0)
  return out
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** 锁屏时调用：生成新盐并保存 hash；调用方随后应清空明文密码 */
export async function setLockSecret(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(LOCK_SALT_BYTES))
  secret = { salt, hash: await digest(salt, password) }
}

/** 解锁时调用：比对成功则清掉 hash 和盐并返回 true */
export async function verifyAndClearLockSecret(password: string): Promise<boolean> {
  if (!secret) return false
  const current = secret
  const ok = equal(await digest(current.salt, password), current.hash)
  if (ok) clearLockSecret()
  return ok
}

export function hasLockSecret(): boolean {
  return secret !== null
}

export function clearLockSecret(): void {
  if (secret) {
    secret.salt.fill(0)
    secret.hash.fill(0)
  }
  secret = null
}

/** 仅供单测检查内存状态 */
export function __peekLockSecretForTest(): Readonly<LockSecret> | null {
  return secret
}
