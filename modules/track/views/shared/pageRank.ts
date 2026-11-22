/**
 * 概览页「页面排行」卡片的三种排行：访问最多、入口页、退出页。
 *
 * 入口页是每次会话看的第一个页面，退出页是最后一个，这两种都按会话算。
 * 后端 `GET /system/track/pages` 用 `type` 区分，返回的字段不一样：
 *
 * - `top`（不传也是它）：`[{ pagePath, pv, uv, avgDurationMs }]`
 * - `entry`：`[{ pagePath, sessions, bounces, bounceRate }]`，跳出是只看了这一页就走的会话
 * - `exit`：`[{ pagePath, sessions, pv, exitRate }]`，退出率 = 在这里结束的会话数 ÷ 这个页面的浏览量
 *
 * 两个比率都是 0 到 1 的小数。入口页、退出页只支持 1 到 30 天，概览页能选的今天、近 7 天、近 30 天都在范围里。
 *
 * @module views/track/shared/pageRank
 */

export type PageRankType = 'top' | 'entry' | 'exit'

/** 卡片上切换按钮的顺序 */
export const PAGE_RANK_TYPES: readonly PageRankType[] = ['top', 'entry', 'exit']

/** 切换按钮上的字 */
export const PAGE_RANK_LABEL_KEY: Record<PageRankType, string> = {
  top: 'pages.track.overview.pageRankTop',
  entry: 'pages.track.overview.pageRankEntry',
  exit: 'pages.track.overview.pageRankExit'
}

/** 标题下面的一句说明：这种排行是怎么算的 */
export const PAGE_RANK_HINT_KEY: Record<PageRankType, string> = {
  top: 'pages.track.overview.pageRankTopHint',
  entry: 'pages.track.overview.pageRankEntryHint',
  exit: 'pages.track.overview.pageRankExitHint'
}

/** 请求里的 type 参数：访问最多不带，和加这个参数以前发的请求一样 */
export function pageRankParam(type: PageRankType): { type?: PageRankType } {
  return type === 'top' ? {} : { type }
}

/** 比率文本：0 到 1 的小数 → 一位小数的百分比；没有值或不是数字 → 「-」 */
export function fmtPageRate(rate?: number | string | null): string {
  if (rate === undefined || rate === null || rate === '') return '-'
  const n = Number(rate)
  if (!Number.isFinite(n)) return '-'
  return `${(n * 100).toFixed(1)}%`
}
