/**
 * 将超过 JS 安全整数范围的 JSON 数字解析为字符串，避免雪花 id 精度丢失。
 * 阈值 16 位：Number.MAX_SAFE_INTEGER 为 16 位十进制数。
 *
 * 仅处理 JSON 结构位（非字符串内）的长整数，避免误改代码预览等字符串字段。
 */
export function parseJsonSafe(text: string): unknown {
  let result = ''
  let i = 0
  let inString = false
  let escaped = false

  while (i < text.length) {
    const ch = text[i]

    if (inString) {
      result += ch
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      i++
      continue
    }

    if (ch === '"') {
      inString = true
      result += ch
      i++
      continue
    }

    const numMatch = text.slice(i).match(/^(-?\d{16,})/)
    if (numMatch) {
      const prev = result.trimEnd().slice(-1)
      if (prev === ':' || prev === '[' || prev === ',') {
        result += `"${numMatch[1]}"`
        i += numMatch[1].length
        continue
      }
    }

    result += ch
    i++
  }

  return JSON.parse(result)
}
