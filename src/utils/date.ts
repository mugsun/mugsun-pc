/**
 * 时间/时长展示格式化工具
 * 表格时间列统一口径：后端 ISO 串（带 T 与微秒）/epoch 毫秒 → 'YYYY-MM-DD HH:mm:ss'
 *
 * @module utils/date
 * @author Mugsun
 */

import { $t } from '@/locales'

const pad = (n: number): string => String(n).padStart(2, '0')

/** 表格时间列统一格式化：ISO 串/epoch 毫秒 → 'YYYY-MM-DD HH:mm:ss'；空/非法 → '-' */
export function formatTableTime(v?: string | number | null): string {
  if (v === undefined || v === null || v === '') return '-'
  let d: Date
  if (typeof v === 'number' || /^\d{10,}$/.test(String(v))) {
    d = new Date(Number(v))
  } else {
    // LocalDateTime 序列化为 ISO 串（微秒 6 位，部分浏览器解析不稳），截掉小数秒段再解析
    // 'YYYY-MM-DD HH:mm:ss' 的空格换成 T（旧版 Safari 不认空格分隔）
    d = new Date(
      String(v)
        .replace(/\.\d+/, '')
        .replace(/^(\d{4}-\d{2}-\d{2}) (?=\d)/, '$1T')
    )
  }
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 表格日期列：同 formatTableTime 的解析口径，只取 'YYYY-MM-DD'；空/非法 → '-' */
export function formatTableDate(v?: string | number | null): string {
  const full = formatTableTime(v)
  return full === '-' ? full : full.slice(0, 10)
}

/** 秒数 → 可读有效期（2592000 → 30 天；86400 → 1 天；不足 1 天按小时；再不足按分钟）；空/非法 → '-' */
export function formatSecondsDuration(v?: number | null): string {
  if (v === undefined || v === null || Number.isNaN(Number(v)) || Number(v) <= 0) return '-'
  const s = Number(v)
  const days = s / 86400
  if (days >= 1) {
    return $t(
      'utils.date.day',
      { value: Number.isInteger(days) ? days : days.toFixed(1) },
      { plural: days }
    )
  }
  const hours = s / 3600
  if (hours >= 1) {
    return $t(
      'utils.date.hour',
      { value: Number.isInteger(hours) ? hours : hours.toFixed(1) },
      { plural: hours }
    )
  }
  const minutes = Math.max(1, Math.round(s / 60))
  return $t('utils.date.minute', { value: minutes }, { plural: minutes })
}
