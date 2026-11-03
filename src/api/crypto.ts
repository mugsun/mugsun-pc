import request from '@/utils/http'

/** GET /api/crypto/bootstrap 响应 data（须已登录且带租户） */
export interface CryptoBootstrapData {
  algorithm: string
  keyHex: string
  keySource: string
}

/**
 * 运行时拉取接口传输密钥。只在已登录时调用；失败由调用方处理，不弹默认 toast。
 * 密钥只作传输混淆，不能替代 HTTPS，不得用于锁屏/本地落库/签名。
 */
export function fetchCryptoBootstrap() {
  return request.get<CryptoBootstrapData>({
    url: '/api/crypto/bootstrap',
    showErrorMessage: false
  })
}
