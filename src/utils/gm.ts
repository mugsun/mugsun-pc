// 国密传输：登录/改密/注册前用后端 SM2 公钥加密密码，抓包非明文。
// 国密开启时加密失败必须 fail-closed，禁止降级明文。
import { sm2 } from 'sm-crypto'
import { fetchSm2PublicKey } from '@/api/auth'

/** 与页面 i18n `pages.auth.login.gmEncryptFailed` 配对，catch 时按此 message 识别 */
export const GM_ENCRYPT_FAILED = 'GM_ENCRYPT_FAILED'

export function isGmEncryptError(e: unknown): boolean {
  return e instanceof Error && e.message === GM_ENCRYPT_FAILED
}

/**
 * 加密传输密码：国密开关开启时用 SM2 公钥加密（sm-crypto cipherMode=1 → C1C3C2，与后端 Hutool 配对）。
 * 每次现取公钥（避免重启换钥后缓存旧钥）；取钥/加密失败抛错，不回传明文。
 */
export async function encryptPassword(pwd: string): Promise<string> {
  let cfg: { gmEnabled: boolean; publicKey: string | null }
  try {
    cfg = await fetchSm2PublicKey()
  } catch {
    throw new Error(GM_ENCRYPT_FAILED)
  }
  if (!cfg.gmEnabled) {
    return pwd
  }
  if (!cfg.publicKey) {
    throw new Error(GM_ENCRYPT_FAILED)
  }
  try {
    return sm2.doEncrypt(pwd, cfg.publicKey, 1)
  } catch {
    throw new Error(GM_ENCRYPT_FAILED)
  }
}
