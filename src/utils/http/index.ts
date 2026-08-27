/**
 * HTTP 请求封装模块
 * 基于 Axios 封装的 HTTP 请求工具，提供统一的请求/响应处理
 *
 * ## 主要功能
 *
 * - 请求/响应拦截器（自动注入 Token、统一错误处理）
 * - 401 未授权自动登出（带防抖机制）
 * - 请求去重 / 防重复提交（在途请求登记：GET 复用在途、变更类拦重复提交）
 * - 路由切换中断在途请求（避免离开页后陈旧响应回填）
 * - 授权流式下载（request.download：文件名解析 + loading + blob 内 JSON 错误回读）
 * - 统一的成功/错误消息提示
 * - 支持 GET/POST/PUT/DELETE 等常用方法
 *
 * @module utils/http
 * @author Mugsun
 */

import axios, { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElLoading } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { ApiStatus } from './status'
import { HttpError, handleError, showError, showSuccess } from './error'
import { $t } from '@/locales'
import { BaseResponse } from '@/types'
import { parseJsonSafe } from '@/utils/json'

/** 请求配置常量 */
const REQUEST_TIMEOUT = 15000
const LOGOUT_DELAY = 500
const UNAUTHORIZED_DEBOUNCE_TIME = 3000

/**
 * 令牌注入方案（Bearer 适配位）：
 * Sa-Token 默认使用裸 token（token-name=Authorization，无前缀）；
 * 若后端切换为标准 OAuth2 Bearer，仅需将此常量改为 'Bearer '，无需改动业务。
 */
const TOKEN_SCHEME = ''

/** 401防抖状态 */
let isUnauthorizedErrorShown = false
let unauthorizedTimer: NodeJS.Timeout | null = null

/** 扩展 AxiosRequestConfig */
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  showErrorMessage?: boolean
  showSuccessMessage?: boolean
  /** R 信封校验旁路：true 时响应拦截器跳过 code 校验、request 原样返回响应体（actuator 等裸 JSON 端点用） */
  skipEnvelope?: boolean
}

/** 下载配置：filename 为解析不到 Content-Disposition 时的兜底文件名 */
interface DownloadConfig extends ExtendedAxiosRequestConfig {
  filename?: string
}

const { VITE_API_URL, VITE_WITH_CREDENTIALS } = import.meta.env

/** Axios实例 */
const axiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  baseURL: VITE_API_URL,
  withCredentials: VITE_WITH_CREDENTIALS === 'true',
  validateStatus: (status) => status >= 200 && status < 300,
  transformResponse: [
    (data, headers) => {
      const contentType = headers['content-type']
      if (contentType?.includes('application/json')) {
        try {
          return typeof data === 'string' ? parseJsonSafe(data) : data
        } catch {
          return data
        }
      }
      return data
    }
  ]
})

// ==================== 请求去重 / 路由中断 ====================

/** 在途请求登记项 */
interface PendingEntry {
  controller: AbortController
  promise: Promise<unknown>
}

/** 在途请求表：key -> 控制器 + 承诺 */
const pendingMap = new Map<string, PendingEntry>()
/** FormData 请求唯一序号（上传不参与去重，但纳入中断） */
let uploadSeq = 0

/** 计算请求指纹：method + url + params + body（FormData 走唯一序号，不去重） */
function requestKey(config: AxiosRequestConfig): string {
  const method = (config.method || 'GET').toUpperCase()
  if (config.data instanceof FormData) {
    return [method, config.url, 'form', ++uploadSeq].join('|')
  }
  const params = config.params ? JSON.stringify(config.params) : ''
  const data = config.data ? JSON.stringify(config.data) : ''
  return [method, config.url, params, data].join('|')
}

/** 取消全部在途请求（路由切换调用，避免离开页后陈旧响应回填） */
export function cancelPendingRequests(): void {
  pendingMap.forEach((entry) => entry.controller.abort())
  pendingMap.clear()
}

/** 是否为取消类错误（路由中断 / 重复提交去重），静默不弹提示 */
function isCancelError(error: unknown): boolean {
  return (error instanceof HttpError && error.canceled) || axios.isCancel(error)
}

/** 请求拦截器 */
axiosInstance.interceptors.request.use(
  (request: InternalAxiosRequestConfig) => {
    const { accessToken } = useUserStore()
    if (accessToken) request.headers.set('Authorization', `${TOKEN_SCHEME}${accessToken}`)

    if (request.data && !(request.data instanceof FormData) && !request.headers['Content-Type']) {
      request.headers.set('Content-Type', 'application/json')
      request.data = JSON.stringify(request.data)
    }

    return request
  },
  (error) => {
    showError(createHttpError($t('httpMsg.requestConfigError'), ApiStatus.error))
    return Promise.reject(error)
  }
)

/** 响应拦截器 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse<BaseResponse>) => {
    // 二进制下载响应跳过业务码校验，交由 download() 处理（blob 内可能是 JSON 错误）
    if (response.config.responseType === 'blob') return response
    // 信封旁路：裸 JSON 端点（actuator/metrics 等无 R 信封）原样放行
    if ((response.config as ExtendedAxiosRequestConfig).skipEnvelope) return response
    const { code, msg } = response.data
    if (code === ApiStatus.success) return response
    if (code === ApiStatus.unauthorized) handleUnauthorizedError(msg)
    throw createHttpError(msg || $t('httpMsg.requestFailed'), code)
  },
  (error) => {
    if (error.response?.status === ApiStatus.unauthorized) handleUnauthorizedError()
    return Promise.reject(handleError(error))
  }
)

/** 统一创建HttpError */
function createHttpError(message: string, code: number) {
  return new HttpError(message, code)
}

/** 处理401错误（带防抖） */
function handleUnauthorizedError(message?: string): never {
  const error = createHttpError(message || $t('httpMsg.unauthorized'), ApiStatus.unauthorized)

  if (!isUnauthorizedErrorShown) {
    isUnauthorizedErrorShown = true
    logOut()

    unauthorizedTimer = setTimeout(resetUnauthorizedError, UNAUTHORIZED_DEBOUNCE_TIME)

    showError(error, true)
    throw error
  }

  throw error
}

/** 重置401防抖状态 */
function resetUnauthorizedError() {
  isUnauthorizedErrorShown = false
  if (unauthorizedTimer) clearTimeout(unauthorizedTimer)
  unauthorizedTimer = null
}

/** 退出登录函数 */
function logOut() {
  setTimeout(() => {
    useUserStore().logOut()
  }, LOGOUT_DELAY)
}

/** 请求函数（含在途去重 + 中断登记） */
async function request<T = any>(config: ExtendedAxiosRequestConfig): Promise<T> {
  // POST | PUT 参数自动填充
  if (
    ['POST', 'PUT'].includes(config.method?.toUpperCase() || '') &&
    config.params &&
    !config.data
  ) {
    config.data = config.params
    config.params = undefined
  }

  const method = (config.method || 'GET').toUpperCase()
  const key = requestKey(config)

  // 在途去重 / 防重复提交
  const existing = pendingMap.get(key)
  if (existing) {
    if (method === 'GET') {
      // GET 透明去重：复用在途请求，不重复发起
      return existing.promise as Promise<T>
    }
    // 变更类：拦截重复提交（在途窗口内的相同请求）
    const dupError = new HttpError($t('utils.http.repeatSubmit'), ApiStatus.error)
    if (config.showErrorMessage !== false) showError(dupError, true)
    return Promise.reject(dupError)
  }

  const controller = new AbortController()
  const exec = (async (): Promise<T> => {
    try {
      const res = await axiosInstance.request<BaseResponse<T>>({
        ...config,
        signal: controller.signal
      })
      if (config.showSuccessMessage && res.data.msg) {
        showSuccess(res.data.msg)
      }
      // 信封旁路时响应体即数据（无 R 信封可拆）
      return (config.skipEnvelope ? res.data : res.data.data) as T
    } catch (error) {
      // 取消（路由中断 / 去重）静默：不弹提示、不脏回填
      if (isCancelError(error)) {
        return Promise.reject(error)
      }
      if (error instanceof HttpError && error.code !== ApiStatus.unauthorized) {
        showError(error, config.showErrorMessage !== false)
      }
      return Promise.reject(error)
    } finally {
      // 仅当登记仍是本次请求时清理，避免误删路由中断后同 key 的新条目
      if (pendingMap.get(key)?.controller === controller) pendingMap.delete(key)
    }
  })()

  pendingMap.set(key, { controller, promise: exec })
  return exec
}

// ==================== 授权流式下载 ====================

/** 解析 Content-Disposition 文件名（优先 RFC5987 filename*=UTF-8''，回退 filename=） */
function parseContentDispositionFilename(disposition?: string): string {
  if (!disposition) return ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      return utf8[1].trim()
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  if (plain?.[1]) {
    try {
      return decodeURIComponent(plain[1].trim())
    } catch {
      return plain[1].trim()
    }
  }
  return ''
}

/** 触发浏览器下载 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * 授权流式下载：带 token 取二进制，解析真实文件名触发浏览器下载。
 * 后端出错时返回 JSON 而非文件字节，此处回读 blob 内 JSON 错误并 toast。
 */
async function download(config: DownloadConfig): Promise<void> {
  const loading = ElLoading.service({
    lock: true,
    text: $t('utils.http.downloading'),
    background: 'rgba(0, 0, 0, 0.35)'
  })
  try {
    const res = await axiosInstance.request<Blob>({
      method: 'GET',
      ...config,
      responseType: 'blob',
      transformResponse: [(data) => data]
    })
    const blob = res.data as Blob
    // blob 内 JSON 错误回读（后端 200 但返回 R 错误信封而非文件字节）
    if (blob.type && blob.type.includes('application/json')) {
      const text = await blob.text()
      let msg = $t('utils.http.downloadFailed')
      try {
        msg = JSON.parse(text)?.msg || msg
      } catch {
        /* 非 JSON 忽略 */
      }
      throw new HttpError(msg, ApiStatus.error)
    }
    const filename =
      parseContentDispositionFilename(res.headers['content-disposition']) ||
      config.filename ||
      'download'
    triggerBrowserDownload(blob, filename)
  } catch (error) {
    // 取消 / 401（已由响应拦截器提示并登出）不重复提示；其余失败统一弹一次。
    // 作为终态 UI 助手，失败已 toast，不再上抛（避免调用方未捕获的 unhandledrejection）
    const silent =
      error instanceof HttpError && (error.canceled || error.code === ApiStatus.unauthorized)
    if (!silent) {
      const message =
        error instanceof HttpError
          ? error.message
          : error instanceof Error
            ? error.message
            : $t('utils.http.downloadFailed')
      showError(
        error instanceof HttpError
          ? error
          : new HttpError(message || $t('utils.http.downloadFailed'), ApiStatus.error),
        true
      )
    }
  } finally {
    loading.close()
  }
}

/** API方法集合 */
const api = {
  get<T>(config: ExtendedAxiosRequestConfig) {
    return request<T>({ ...config, method: 'GET' })
  },
  post<T>(config: ExtendedAxiosRequestConfig) {
    return request<T>({ ...config, method: 'POST' })
  },
  put<T>(config: ExtendedAxiosRequestConfig) {
    return request<T>({ ...config, method: 'PUT' })
  },
  del<T>(config: ExtendedAxiosRequestConfig) {
    return request<T>({ ...config, method: 'DELETE' })
  },
  request<T>(config: ExtendedAxiosRequestConfig) {
    return request<T>(config)
  },
  /** 授权流式下载 */
  download(config: DownloadConfig) {
    return download(config)
  }
}

export default api
