/**
 * HTTP 错误处理模块
 *
 * 提供统一的 HTTP 请求错误处理机制
 *
 * ## 主要功能
 *
 * - 自定义 HttpError 错误类，封装错误信息、状态码、时间戳等
 * - 错误拦截和转换，将 Axios 错误转换为标准的 HttpError
 * - 错误消息国际化处理，根据状态码返回对应的多语言错误提示
 * - 错误日志记录，便于问题追踪和调试
 * - 错误和成功消息的统一展示
 * - 类型守卫函数，用于判断错误类型
 *
 * ## 使用场景
 *
 * - HTTP 请求拦截器中统一处理错误
 * - 业务代码中捕获和处理特定错误
 * - 错误日志收集和上报
 *
 * @module utils/http/error
 * @author Mugsun
 */
import { AxiosError } from 'axios'
import { ApiStatus } from './status'
import { $t } from '@/locales'

// 错误响应接口
export interface ErrorResponse {
  /** 错误状态码 */
  code: number
  /** 错误消息 */
  msg: string
  /** 错误附加数据 */
  data?: unknown
}

// 错误日志数据接口
export interface ErrorLogData {
  /** 错误状态码 */
  code: number
  /** 错误消息 */
  message: string
  /** 错误附加数据 */
  data?: unknown
  /** 错误发生时间戳 */
  timestamp: string
  /** 请求 URL */
  url?: string
  /** 请求方法 */
  method?: string
  /** 错误堆栈信息 */
  stack?: string
}

/** 错误种类：network 无响应；http 非 2xx；business HTTP 200 但业务码失败 */
export type HttpErrorKind = 'network' | 'http' | 'business'

// 自定义 HttpError 类
export class HttpError extends Error {
  public readonly code: number
  public readonly data?: unknown
  public readonly timestamp: string
  public readonly url?: string
  public readonly method?: string
  /** 是否为请求取消（路由切换中断 / 重复提交去重），取消不弹错误提示 */
  public readonly canceled: boolean
  /** 错误种类（UX-009：网络异常为 network，code 为 ApiStatus.network=0，不再当成 400） */
  public readonly errorKind: HttpErrorKind
  /** 业务码（R.code）；HTTP 200 业务失败或非 2xx 响应体里带 code 时有值 */
  public readonly bizCode?: number
  /**
   * 已向用户提示过（toast）。埋点 SDK 在 skipHandledErrors 为 true 时据此（及 name==='HttpError'）
   * 跳过 $error 上报；管理台本身不再拦截，是否跳过由 SDK 开关决定。
   */
  public handled = false

  constructor(
    message: string,
    code: number,
    options?: {
      data?: unknown
      url?: string
      method?: string
      canceled?: boolean
      errorKind?: HttpErrorKind
      bizCode?: number
    }
  ) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.data = options?.data
    this.timestamp = new Date().toISOString()
    this.url = options?.url
    this.method = options?.method
    this.canceled = options?.canceled ?? false
    this.errorKind = options?.errorKind ?? 'http'
    this.bizCode = options?.bizCode
  }

  /** 是否网络异常（无响应） */
  public get isNetworkError(): boolean {
    return this.errorKind === 'network'
  }

  public toLogData(): ErrorLogData & { error_kind: HttpErrorKind; biz_code?: number } {
    return {
      code: this.code,
      error_kind: this.errorKind,
      biz_code: this.bizCode,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
      url: this.url,
      method: this.method,
      stack: this.stack
    }
  }
}

/**
 * 获取错误消息
 * @param status 错误状态码
 * @returns 错误消息
 */
const getErrorMessage = (status: number): string => {
  const errorMap: Record<number, string> = {
    [ApiStatus.unauthorized]: 'httpMsg.unauthorized',
    [ApiStatus.forbidden]: 'httpMsg.forbidden',
    [ApiStatus.notFound]: 'httpMsg.notFound',
    [ApiStatus.methodNotAllowed]: 'httpMsg.methodNotAllowed',
    [ApiStatus.requestTimeout]: 'httpMsg.requestTimeout',
    [ApiStatus.internalServerError]: 'httpMsg.internalServerError',
    [ApiStatus.badGateway]: 'httpMsg.badGateway',
    [ApiStatus.serviceUnavailable]: 'httpMsg.serviceUnavailable',
    [ApiStatus.gatewayTimeout]: 'httpMsg.gatewayTimeout'
  }

  return $t(errorMap[status] || 'httpMsg.internalServerError')
}

/**
 * 处理错误
 * @param error 错误对象
 * @returns 错误对象
 */
export function handleError(error: AxiosError<ErrorResponse>): never {
  // 处理取消的请求
  if (error.code === 'ERR_CANCELED') {
    console.warn('Request cancelled:', error.message)
    throw new HttpError($t('httpMsg.requestCancelled'), ApiStatus.error, { canceled: true })
  }

  const statusCode = error.response?.status
  const rawMsg = error.response?.data?.msg
  // 服务端业务文案（非空字符串）优先，含 401/403
  const businessMsg = typeof rawMsg === 'string' && rawMsg.trim() ? rawMsg : ''
  const requestConfig = error.config

  // 处理网络错误
  if (!error.response) {
    throw new HttpError($t('httpMsg.networkError'), ApiStatus.network, {
      url: requestConfig?.url,
      method: requestConfig?.method?.toUpperCase(),
      errorKind: 'network'
    })
  }

  // 处理 HTTP 状态码错误
  // 优先业务文案，其次按状态码的多语言文案，最后通用文案
  const message =
    businessMsg ||
    (statusCode ? getErrorMessage(statusCode) : error.message || $t('httpMsg.requestFailed'))
  const rawCode = (error.response.data as { code?: unknown } | undefined)?.code
  throw new HttpError(message, statusCode || ApiStatus.error, {
    data: error.response.data,
    bizCode: typeof rawCode === 'number' ? rawCode : undefined,
    url: requestConfig?.url,
    method: requestConfig?.method?.toUpperCase()
  })
}

/**
 * 显示错误消息
 * @param error 错误对象
 * @param showMessage 是否显示消息（false = 静默请求：预览/探测类调用，不弹窗也不污染控制台）
 */
export function showError(error: HttpError, showMessage: boolean = true): void {
  if (!showMessage) {
    return
  }
  ElMessage.error(error.message)
  // 已提示给用户：SDK 在 skipHandledErrors=true 时据此跳过
  error.handled = true
  // 记录错误日志
  console.error('[HTTP Error]', error.toLogData())
}

/**
 * 显示成功消息
 * @param message 成功消息
 * @param showMessage 是否显示消息
 */
export function showSuccess(message: string, showMessage: boolean = true): void {
  if (showMessage) {
    ElMessage.success(message)
  }
}

/**
 * 判断是否为 HttpError 类型
 * @param error 错误对象
 * @returns 是否为 HttpError 类型
 */
export const isHttpError = (error: unknown): error is HttpError => {
  return error instanceof HttpError
}

/** 是否网络异常（无响应）的 HttpError */
export const isNetworkError = (error: unknown): error is HttpError =>
  error instanceof HttpError && error.errorKind === 'network'
