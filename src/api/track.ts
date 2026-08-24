import request from '@/utils/http'

// ===== 埋点分析 =====
/** 概览卡片 + 来源/设备/浏览器分布（days 缺省 7，范围 1..90） */
export function fetchTrackOverview(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/overview', params })
}
/** 趋势：days≤2 按小时（time=epochMs），days>2 按天（date）；dimType=overview/event/page/referrer/device */
export function fetchTrackTrend(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/track/trend', params })
}
/** Top 页面（pagePath/pv/uv/avgDurationMs） */
export function fetchTrackPages(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/track/pages', params })
}
/** 事件分析分页（eventName 可筛，按次数降序） */
export function fetchTrackEventPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/events/page', params })
}
/** 实时事件流（最近 limit 条） */
export function fetchTrackEventRealtime(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/track/events/realtime', params })
}
/** 当前在线人数（近 windowSeconds 秒活跃会话） */
export function fetchTrackOnline(params: Record<string, any>) {
  return request.get<{ online: number; windowSeconds: number }>({
    url: '/api/system/track/online',
    params
  })
}
/** Web Vitals 分位（CLS 千分制，其余毫秒） */
export function fetchTrackVitals(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/track/vitals', params })
}
/** 错误指纹分组分页（按最近发生降序） */
export function fetchTrackErrorPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/errors/page', params })
}
/** 指纹组内错误事件分页（props 为 JSON 字符串，含 breadcrumbs） */
export function fetchTrackErrorDetail(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/errors/detail', params })
}

// ===== 会话回放 =====
/** 回放会话分页（appKey/hasError 可筛，startTime 倒序） */
export function fetchTrackReplayPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/replay/page', params })
}
/** 回放详情：{replay: 会话元数据, blocks: [{seq, key}]}（探测场景调用方自处理失败，不弹错误提示） */
export function fetchTrackReplayDetail(params: Record<string, any>) {
  return request.get<any>({
    url: '/api/system/track/replay/detail',
    params,
    showErrorMessage: false
  })
}
/**
 * 回放块内容：rrweb 事件数组 JSON 明文（服务端已解压，R 信封外的裸 JSON 端点 → skipEnvelope）。
 * 块缺失/过期时后端走 R 错误信封，此处原样抛出由调用方容错跳过。
 */
export function fetchTrackReplayData(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/track/replay/data', params, skipEnvelope: true })
}

// ===== 埋点应用 =====
export function fetchTrackAppPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/app/page', params })
}
/** 新增（服务端生成 appKey 并返回完整实体）/ 编辑（带 id） */
export function fetchSaveTrackApp(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/track/app/submit', data })
}
export function fetchRemoveTrackApp(id: number | string) {
  return request.post<void>({ url: '/api/system/track/app/remove', data: { id } })
}

// ===== 用户细查（G102） =====
/**
 * 行为时间线游标分页：{records: [{eventId,eventName,ts,clientTs,urlPath,routePath,durationMs,
 * sessionId,props(JSON 字符串),hasReplay,hasApiBody}], nextCursor}——received_at+id 倒序；
 * userId/distinctId 二选一（userId 经 track_identity 归并匿名期行为）；范围硬限 ≤7 天（超界 400）。
 */
export function fetchTrackUserTimeline(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/user/timeline', params })
}
/**
 * 接口响应体明文 JSON（application/json 直发，非 R 信封 → skipEnvelope）；
 * 未采集/已过保留期 400——调用方按「未采集」占位展示，不弹错误提示。
 */
export function fetchTrackUserApiBody(params: Record<string, any>) {
  return request.get<any>({
    url: '/api/system/track/user/api-body',
    params,
    skipEnvelope: true,
    showErrorMessage: false
  })
}

// ===== 符号表（sourcemap，G101） =====
/** 分页（appKey 必填，release 可选精确筛）；records 为行投影（不含存储坐标） */
export function fetchTrackSourcemapPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/sourcemap/page', params })
}
/** 上传（multipart：file/appKey/release；.map ≤20MB 须含 mappings；同 appKey+release+filename 重传覆盖） */
export function fetchUploadTrackSourcemap(data: FormData) {
  return request.post<any>({ url: '/api/system/track/sourcemap/upload', data })
}
export function fetchRemoveTrackSourcemap(id: number | string) {
  return request.post<void>({ url: '/api/system/track/sourcemap/remove', data: { id } })
}
/** .map 原文（application/json 直发，非 R 信封 → skipEnvelope；axios 已解析为对象，可直接喂 source-map-js） */
export function fetchTrackSourcemapRaw(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/sourcemap/raw', params, skipEnvelope: true })
}

// ===== 事件定义 =====
export function fetchTrackEventDefPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/event-def/page', params })
}
/** 仅 displayName/description/owner/status 可改 */
export function fetchSaveTrackEventDef(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/track/event-def/submit', data })
}

// ===== 漏斗分析（G103） =====
/**
 * 有序漏斗：{steps: [{eventName, count}], days, windowHours}——actor 经 identity 归并，
 * 有序非紧邻匹配，首步后 windowHours 内依次触达才算转化；steps 2-5 步、days ≤30（超界 400）。
 */
export function fetchTrackFunnel(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/funnel', params })
}

// ===== 留存分析（G103） =====
/**
 * 新客留存网格：{rows: [{cohortDate, cohortSize, retained: {offset: n}}]}——
 * cohort=窗口内新客（首活跃日 > 回看窗首日，截断保守排除），活跃=当天任意事件，UTC 日切；days ≤30。
 */
export function fetchTrackRetention(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/retention', params })
}

// ===== 回放会话事件（G105） =====
/** 会话事件流（打点用）：[{eventName, ts(epochMs), urlPath}] 按 ts 升序 ≤500；空会话返回空数组 */
export function fetchTrackReplayEvents(params: Record<string, any>) {
  return request.get<any[]>({
    url: '/api/system/track/replay/events',
    params,
    showErrorMessage: false
  })
}

// ===== 圈选式可视化埋点（G104） =====
/** 签发圈选令牌：{token, url, expireSeconds}；targetUrl 可空=平台 origin，url 已拼 __mst_inspect 参数 */
export function fetchTrackVisualToken(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/track/visual/token', data })
}
/** 草稿列表（令牌有效期内；3s 轮询用，失败不弹提示） */
export function fetchTrackVisualDrafts(params: Record<string, any>) {
  return request.get<any[]>({
    url: '/api/system/track/visual/drafts',
    params,
    showErrorMessage: false
  })
}
/** 草稿确认成规则（eventName 可改） */
export function fetchTrackVisualConfirm(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/track/visual/drafts/confirm', data })
}
/** 草稿丢弃 */
export function fetchTrackVisualDiscard(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/track/visual/drafts/discard', data })
}
/** 圈选规则分页 */
export function fetchTrackVisualRulePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/track/visual/rule/page', params })
}
/** 规则编辑（eventName/routePath/matchText/status 可改，selector 只读） */
export function fetchSaveTrackVisualRule(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/track/visual/rule/submit', data })
}
export function fetchRemoveTrackVisualRule(id: number | string) {
  return request.post<void>({ url: '/api/system/track/visual/rule/remove', data: { id } })
}

/** 地域分布 + 精确热力点（G106） */
export function fetchTrackGeo(params: Record<string, any>) {
  return request.get<{
    regions: { region: string; pv: number; uv: number; eventCount: number }[]
    points: { lon: number; lat: number; eventName?: string; ts?: number; urlPath?: string }[]
    geoCount: number
  }>({ url: '/api/system/track/geo', params, showErrorMessage: false })
}
