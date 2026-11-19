/**
 * 第三方授权的发起记录：登录页 / 个人中心跳去第三方之前在本标签页记一条，回调页只处理对得上的那条。
 * 别人发来的回调链接（state 不是本标签页发起的）不绑定也不登录，防止被诱导绑定或登进别人的账号。
 * 放 sessionStorage：只在发起授权的这个标签页里有效，跳去第三方再回来仍在。
 */
export type SocialFlowPurpose = 'login' | 'bind'

interface SocialFlowRecord {
  purpose: SocialFlowPurpose
  source: string
  state: string
  at: number
}

const KEY = 'mugsun-social-flow'
// 比后端 state 的 3 分钟宽一些：过期由后端判，这里只是不让陈旧记录一直留着
const TTL_MS = 10 * 60 * 1000

/** 跳转第三方之前调用：从授权地址里取出 state 记下来 */
export function rememberSocialFlow(
  purpose: SocialFlowPurpose,
  source: string,
  authorizeUrl: string
): void {
  const state = new URL(authorizeUrl, window.location.href).searchParams.get('state')
  if (!state) {
    sessionStorage.removeItem(KEY)
    return
  }
  const record: SocialFlowRecord = { purpose, source, state, at: Date.now() }
  sessionStorage.setItem(KEY, JSON.stringify(record))
}

/** 回调页调用：取出并清掉记录；来源和 state 都对得上、没过期才返回发起时的用途，否则返回 null */
export function takeSocialFlow(source: string, state: string): SocialFlowPurpose | null {
  const raw = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  if (!raw) return null
  try {
    const record = JSON.parse(raw) as SocialFlowRecord
    const fresh = Date.now() - record.at < TTL_MS
    return fresh && record.source === source && record.state === state ? record.purpose : null
  } catch {
    return null
  }
}
