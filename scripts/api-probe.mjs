#!/usr/bin/env node
/**
 * API 探针：登录链路 + 性能测量 + 安全探针（功能测试矩阵补测工具）。
 *
 * 用法：
 *   node scripts/api-probe.mjs login [username] [password]   # 打印 token
 *   node scripts/api-probe.mjs perf                          # 关键列表端点 RT 测量（p50/p95/max）
 *   node scripts/api-probe.mjs sec                           # 8 个无安全验证记录域 + 全局探针
 *   node scripts/api-probe.mjs track-feed [batches] [size]   # collect 灌注（默认 100 批×100 事件，p50/p95/max + 落库核对）
 *
 * 环境：PROBE_BASE（默认 http://localhost:8080，直连后端，不经 vite 代理）
 *       PROBE_REDIS（默认 blade-redis）、PROBE_REDIS_DB（默认 3）
 *       PROBE_TRACK_APP_KEY（默认 T2 种子 ak_000000000000000000000001）
 * 登录复刻集成测试链路：取验证码 → Redis 读答案 → SM2 公钥加密（开启时）→ 登录换 token。
 */
import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import smCrypto from 'sm-crypto'

const BASE = process.env.PROBE_BASE || 'http://localhost:8080'
const REDIS = process.env.PROBE_REDIS || 'blade-redis'
const REDIS_DB = process.env.PROBE_REDIS_DB || '3'
const TENANT = '000000'
/** 埋点默认应用种子 app_key（与后端 track 库 T2 迁移种子一致） */
const TRACK_APP_KEY = process.env.PROBE_TRACK_APP_KEY || 'ak_000000000000000000000001'
/** 落库计数核对用的 track 库 psql 容器坐标 */
const PG_CONTAINER = process.env.PROBE_PG_CONTAINER || 'mugsun-pg'
const PG_DB_TRACK = process.env.PROBE_PG_TRACK_DB || 'mugsun_track'

// ---------- 基础 ----------

function readCaptcha(uuid) {
  const out = execSync(`docker exec ${REDIS} redis-cli -n ${REDIS_DB} GET mugsun:captcha:${uuid}`, {
    encoding: 'utf-8'
  }).trim()
  if (!out) throw new Error(`验证码不存在或已过期: ${uuid}`)
  return out
}

async function api(method, path, { token, body, headers = {} } = {}) {
  const h = { ...headers }
  if (token) h.Authorization = token
  let payload
  if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const resp = await fetch(BASE + path, { method, headers: h, body: payload })
  const text = await resp.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 非 JSON（如 actuator 裸指标） */
  }
  return {
    http: resp.status,
    code: json?.code ?? null,
    msg: json?.msg ?? '',
    data: json?.data,
    raw: text
  }
}

async function login(username = 'admin', password = '123456') {
  const cap = await api('GET', '/auth/captcha')
  const uuid = cap.data?.captchaUuid
  if (!uuid) throw new Error('取验证码失败: ' + cap.raw)
  const code = readCaptcha(uuid)
  const key = await api('GET', '/auth/sm2-public-key')
  let finalPassword = password
  if (key.data?.gmEnabled) {
    finalPassword = smCrypto.sm2.doEncrypt(password, key.data.publicKey, 1) // C1C3C2，无 04 前缀
  }
  const resp = await api('POST', '/auth/login', {
    body: {
      tenantId: TENANT,
      username,
      password: finalPassword,
      captchaUuid: uuid,
      captchaCode: code,
      clientId: 'web'
    }
  })
  const token = resp.data?.token
  if (!token) throw new Error(`登录失败(${username}): code=${resp.code} msg=${resp.msg}`)
  return token
}

// ---------- 性能测量 ----------

const PERF_TARGETS = [
  ['oper-log', '/system/oper-log/page?pageNum=1&pageSize=20'],
  ['oper-log-deep', '/system/oper-log/page?pageNum={DEEP}&pageSize=20'],
  ['login-log', '/system/login-log/page?pageNum=1&pageSize=20'],
  ['login-log-deep', '/system/login-log/page?pageNum={DEEP}&pageSize=20'],
  ['api-log', '/system/api-log/page?pageNum=1&pageSize=20'],
  ['api-log-deep', '/system/api-log/page?pageNum={DEEP}&pageSize=20'],
  ['user', '/system/user/page?pageNum=1&pageSize=20'],
  ['attach', '/system/file/page?pageNum=1&pageSize=20'],
  ['message-my', '/system/message/my/page?pageNum=1&pageSize=20'],
  ['dict-tree', '/system/dict/tree'],
  ['dict-biz-tree', '/system/dict-biz/tree'],
  ['data-audit', '/system/data-audit/page?pageNum=1&pageSize=20'],
  ['error-log', '/system/error-log/page?pageNum=1&pageSize=20'],
  ['form-page', '/system/form/page?pageNum=1&pageSize=20'],
  ['cache-groups', '/system/cache/groups'],
  ['mail-template', '/system/mail-template/page?pageNum=1&pageSize=20'],
  ['msg-template', '/system/message-template/page?pageNum=1&pageSize=20'],
  ['sms', '/system/sms/page?pageNum=1&pageSize=20'],
  ['region-lazy', '/system/region/lazy-tree?parentCode=00'],
  // §3.6 盲区补测：notice / oss / tenant / job / report / flow / 开放平台
  ['notice', '/system/notice/page?pageNum=1&pageSize=20'],
  ['oss', '/system/oss/page?pageNum=1&pageSize=20'],
  ['tenant', '/system/tenant/list'],
  ['job-processors', '/system/job/processors'],
  ['report', '/system/report/list'],
  ['flow-todo', '/system/flow/my-todo'],
  ['flow-definitions', '/system/flow/definitions'],
  ['api-key', '/system/api-key/page?pageNum=1&pageSize=20'],
  ['oauth-client', '/system/oauth-client/page?pageNum=1&pageSize=20'],
  ['oauth-log', '/system/oauth-log/page?pageNum=1&pageSize=20'],
  // track 埋点分析端点（种子应用见 track 库 T2 迁移）
  ['track-overview', `/system/track/overview?appKey=${TRACK_APP_KEY}&days=7`],
  ['track-trend', `/system/track/trend?appKey=${TRACK_APP_KEY}&days=7&dimType=overview`],
  ['track-pages', `/system/track/pages?appKey=${TRACK_APP_KEY}&days=7&limit=10`],
  ['track-vitals', `/system/track/vitals?appKey=${TRACK_APP_KEY}&days=7`],
  [
    'track-errors-page',
    `/system/track/errors/page?appKey=${TRACK_APP_KEY}&days=7&pageNum=1&pageSize=20`
  ]
]

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return Math.round(sorted[idx])
}

async function runPerf(token, deepPage) {
  const requests = Number(process.env.PROBE_REQUESTS || 100)
  const concurrency = Number(process.env.PROBE_CONCURRENCY || 10)
  console.log(`# perf base=${BASE} requests=${requests} concurrency=${concurrency}`)
  for (const [name, rawPath] of PERF_TARGETS) {
    const path = rawPath.replace('{DEEP}', String(deepPage))
    // 预热 2 次（JIT/连接池）
    for (let i = 0; i < 2; i++) await api('GET', path, { token })
    const rts = []
    let err = 0
    let cursor = 0
    async function worker() {
      while (cursor < requests) {
        cursor++
        const t0 = performance.now()
        const r = await api('GET', path, { token })
        rts.push(performance.now() - t0)
        if (r.code !== 200) err++
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
    rts.sort((a, b) => a - b)
    console.log(
      `[PERF] ${name} n=${requests} c=${concurrency} p50=${percentile(rts, 50)}ms p95=${percentile(rts, 95)}ms max=${Math.round(rts[rts.length - 1])}ms err=${err}`
    )
  }
}

// ---------- 安全探针 ----------

/** 8 个无安全验证记录域的端点（读 + 写），writes 供 401/403 探针 */
const SEC_TARGETS = [
  {
    name: 'dict-biz',
    read: '/system/dict-biz/tree',
    writes: [
      ['POST', '/system/dict-biz/submit', { code: 'SEC_PROBE', dictValue: 'SEC-PROBE-若见请删除' }],
      ['POST', '/system/dict-biz/remove', [0]]
    ],
    inject: "/system/dict-biz/tree?dictValue='%20OR%20'1'%3D'1"
  },
  {
    name: 'message-template',
    read: '/system/message-template/page?pageNum=1&pageSize=20',
    writes: [
      [
        'POST',
        '/system/message-template/submit',
        { code: 'SEC_PROBE', name: 'SEC-PROBE-若见请删除', content: 'x' }
      ],
      ['POST', '/system/message-template/remove', [0]]
    ],
    inject: "/system/message-template/page?pageNum=1&pageSize=20&name='%20OR%20'1'%3D'1"
  },
  {
    name: 'mail-template',
    read: '/system/mail-template/page?pageNum=1&pageSize=20',
    writes: [
      [
        'POST',
        '/system/mail-template/submit',
        { code: 'SEC_PROBE', name: 'SEC-PROBE-若见请删除', subject: 'x', content: 'x' }
      ],
      ['POST', '/system/mail-template/remove', [0]]
    ],
    inject: "/system/mail-template/page?pageNum=1&pageSize=20&name='%20OR%20'1'%3D'1"
  },
  {
    name: 'sms',
    read: '/system/sms/page?pageNum=1&pageSize=20',
    writes: [
      ['POST', '/system/sms/submit', { name: 'SEC-PROBE-若见请删除', platform: 'SEC_PROBE' }],
      ['POST', '/system/sms/remove', [0]],
      ['POST', '/system/sms/enable/0', undefined]
    ],
    inject: "/system/sms/page?pageNum=1&pageSize=20&name='%20OR%20'1'%3D'1"
  },
  {
    name: 'region',
    read: '/system/region/lazy-tree?parentCode=00',
    writes: [
      [
        'POST',
        '/system/region/submit',
        { code: 'SEC_PROBE', name: 'SEC-PROBE-若见请删除', parentCode: '00' }
      ],
      ['POST', '/system/region/remove/0', undefined]
    ],
    inject: "/system/region/lazy-tree?parentCode=00'%20OR%20'1'%3D'1"
  },
  {
    name: 'cache',
    read: '/system/cache/groups',
    writes: [['POST', '/system/cache/remove', ['SEC_PROBE_NO_SUCH_KEY']]],
    inject: "/system/cache/keys?group='%20OR%20'1'%3D'1"
  },
  {
    name: 'form',
    read: '/system/form/page?pageNum=1&pageSize=20',
    writes: [
      ['POST', '/system/form/submit', { formKey: 'SEC_PROBE', formName: 'SEC-PROBE-若见请删除' }],
      ['POST', '/system/form/remove', [0]]
    ],
    inject: "/system/form/page?pageNum=1&pageSize=20&formName='%20OR%20'1'%3D'1"
  },
  {
    name: 'error-log',
    read: '/system/error-log/page?pageNum=1&pageSize=20',
    writes: [
      ['POST', '/system/error-log/handle', { id: 0, status: 1, note: 'SEC-PROBE' }],
      ['DELETE', '/system/error-log/remove?id=0', undefined]
    ],
    inject: "/system/error-log/page?pageNum=1&pageSize=20&title='%20OR%20'1'%3D'1"
  }
]

function verdict(ok, detail) {
  return `${ok ? 'PASS' : 'FAIL'} ${detail}`
}

async function runSec(adminToken, frontToken) {
  console.log('# sec probes：无 token 401 / 低权写 403 / 伪造租户头 / 注入不 500')
  let fails = 0
  const report = (name, check, ok, detail) => {
    if (!ok) fails++
    console.log(`[SEC] ${name} ${check} ${verdict(ok, detail)}`)
  }

  for (const t of SEC_TARGETS) {
    // 1) 无 token：读/写均须 401
    const noauthRead = await api('GET', t.read)
    report(t.name, 'noauth-read', noauthRead.code === 401, `code=${noauthRead.code}`)
    const [wm, wp, wb] = t.writes[0]
    const noauthWrite = await api(wm, wp, { body: wb })
    report(t.name, 'noauth-write', noauthWrite.code === 401, `code=${noauthWrite.code}`)
    // 2) 低权账号（fronttest）写端点：须 403（200=越权嫌疑，400=落在校验需复核）
    for (const [m, p, b] of t.writes) {
      const r = await api(m, p, { token: frontToken, body: b })
      report(
        t.name,
        `noperm ${m} ${p}`,
        r.code === 403,
        `code=${r.code}${r.code === 200 ? ' ← 低权可写，复核！' : ''}`
      )
    }
    // 3) 伪造租户头（admin token + X-Tenant-Id:999999）：须 403 或数据不串
    const forged = await api('GET', t.read, {
      token: adminToken,
      headers: { 'X-Tenant-Id': '999999' }
    })
    report(
      t.name,
      'tenant-forge',
      forged.code === 403 || forged.code === 200,
      `code=${forged.code}（403=拦截，200=按上下文忽略伪造头）`
    )
    // 4) 注入串：包络级校验——不得 5xx（内容级 SQL 错误检测对日志域会误报，其 stacktrace 字段本就是业务数据；
    //    深度注入防护由 MyBatis-Flex 参数化查询 + e2e adversarial spec 覆盖）
    const inj = await api('GET', t.inject, { token: adminToken })
    report(
      t.name,
      'inject',
      inj.code !== 500 && inj.http < 500,
      `code=${inj.code} http=${inj.http}`
    )
  }

  // 全局：伪造 token / actuator 未授权
  const fakeToken = await api('GET', '/system/user/page?pageNum=1&pageSize=1', {
    token: 'sec-probe-fake-token'
  })
  report('global', 'fake-token', fakeToken.code === 401, `code=${fakeToken.code}`)
  const actuator = await api('GET', '/actuator/env')
  report(
    'global',
    'actuator-env-noauth',
    actuator.http === 401 || actuator.http === 403 || actuator.code === 401,
    `http=${actuator.http}`
  )

  // track 分析端点：无 token 401；伪造租户头不串数（同 8 域口径：403=拦截，200=按 token 上下文忽略伪造头）
  const trackRead = `/system/track/overview?appKey=${TRACK_APP_KEY}&days=1`
  const trackNoauth = await api('GET', trackRead)
  report('track', 'noauth-read', trackNoauth.code === 401, `code=${trackNoauth.code}`)
  const trackForged = await api('GET', trackRead, {
    token: adminToken,
    headers: { 'X-Tenant-Id': '999999' }
  })
  report(
    'track',
    'tenant-forge',
    trackForged.code === 403 || trackForged.code === 200,
    `code=${trackForged.code}（403=拦截，200=按上下文忽略伪造头）`
  )
  console.log(`# sec done, fails=${fails}`)
}

// ---------- collect 灌注（埋点摄入链路压测） ----------

/** 构造一批上报体：$pageview × batchSize（event_id 逐条随机，props 标记 /feed/probe 供落库核对） */
function collectPayload(batchSize, batchNo) {
  const now = Date.now()
  const events = []
  for (let i = 0; i < batchSize; i++) {
    events.push({
      event_id: crypto.randomUUID(),
      event: '$pageview',
      ts: now,
      distinct_id: `feed-distinct-${batchNo % 20}`,
      user_id: null,
      session_id: `feed-session-${batchNo % 20}`,
      props: { url_path: '/feed/probe', page_title: '灌注探针' }
    })
  }
  return {
    app_key: TRACK_APP_KEY,
    schema_version: '1.0',
    sdk: { platform: 'web', version: 'api-probe' },
    sent_at: now,
    events
  }
}

/** track_event 落库计数（灌注窗口内 /feed/probe 行数；-1 表示 psql 不可用） */
function feedLandedCount(startMs) {
  try {
    const out = execSync(
      `docker exec ${PG_CONTAINER} psql -U mugsun -d ${PG_DB_TRACK} -t -c "SELECT count(*) FROM track_event WHERE url_path = '/feed/probe' AND received_at >= to_timestamp(${startMs} / 1000.0)"`,
      { encoding: 'utf-8' }
    ).trim()
    return Number(out) || 0
  } catch {
    return -1
  }
}

/**
 * 灌注：batches 批 × batchSize 事件 POST /track/collect（匿名端点，无需 token；
 * 注意服务端 IP+appKey 分钟窗限流 600，batches 勿超窗）。
 * 统计批级 RT p50/p95/max 与 200 率；灌后轮询落库计数并打印人工核对 SQL。
 */
async function runTrackFeed(batches, batchSize) {
  const concurrency = Number(process.env.PROBE_CONCURRENCY || 5)
  console.log(
    `# track-feed base=${BASE} appKey=${TRACK_APP_KEY} batches=${batches} batchSize=${batchSize} c=${concurrency}`
  )
  const startMs = Date.now()
  const rts = []
  let ok200 = 0
  let accepted = 0
  let cursor = 0
  async function worker() {
    while (cursor < batches) {
      const no = cursor++
      const t0 = performance.now()
      const r = await api('POST', '/track/collect', { body: collectPayload(batchSize, no) })
      rts.push(performance.now() - t0)
      if (r.http === 200 && r.code === 200) ok200++
      else console.log(`[FEED] batch#${no} 异常：http=${r.http} code=${r.code} msg=${r.msg}`)
      accepted += Number(r.data?.received ?? 0)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  rts.sort((a, b) => a - b)
  const total = batches * batchSize
  console.log(
    `[FEED] collect n=${batches}批×${batchSize}=${total} 事件 p50=${percentile(rts, 50)}ms p95=${percentile(rts, 95)}ms max=${Math.round(rts[rts.length - 1])}ms 200率=${((ok200 / batches) * 100).toFixed(1)}% 服务端接收=${accepted}`
  )
  // 落库核对：消费侧异步批量写，轮询至计数收敛（psql 不可用则跳过并给出人工核对 SQL）
  const checkSql = `SELECT count(*) FROM track_event WHERE url_path = '/feed/probe' AND received_at >= to_timestamp(${startMs} / 1000.0)`
  const deadline = Date.now() + 20_000
  let landed = feedLandedCount(startMs)
  while (landed >= 0 && landed < accepted && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1_000))
    landed = feedLandedCount(startMs)
  }
  if (landed < 0) {
    console.log(
      `[FEED] psql 不可用，人工核对：docker exec ${PG_CONTAINER} psql -U mugsun -d ${PG_DB_TRACK} -c "${checkSql}"`
    )
  } else {
    console.log(
      `[FEED] 落库核对：landed=${landed} / accepted=${accepted}${landed === accepted ? '（一致）' : '（不一致，复核消费侧）'}；人工核对 SQL：${checkSql}`
    )
  }
}

// ---------- 入口 ----------

const [, , cmd, ...args] = process.argv
const deepPage = Number(process.env.PROBE_DEEP_PAGE || 0)

if (cmd === 'login') {
  const token = await login(args[0], args[1])
  console.log(token)
} else if (cmd === 'perf') {
  const token = await login('admin', '123456')
  if (!deepPage) {
    // 自动估算深翻页页码：oper-log 总数 / pageSize 的一半处
    const r = await api('GET', '/system/oper-log/page?pageNum=1&pageSize=20', { token })
    const total = r.data?.totalRow ?? r.data?.total ?? 0
    console.log(`# oper-log total=${total}`)
    await runPerf(token, Math.max(1, Math.floor(total / 40)))
  } else {
    await runPerf(token, deepPage)
  }
} else if (cmd === 'sec') {
  const admin = await login('admin', '123456')
  const front = await login('fronttest', '123456')
  await runSec(admin, front)
} else if (cmd === 'track-feed') {
  // collect 灌注：node scripts/api-probe.mjs track-feed [批数=100] [每批事件数=100]
  await runTrackFeed(
    Number(args[0] || process.env.PROBE_TRACK_BATCHES || 100),
    Number(args[1] || process.env.PROBE_TRACK_BATCH_SIZE || 100)
  )
} else {
  console.error('用法: api-probe.mjs login|perf|sec|track-feed [batches] [batchSize]')
  process.exit(1)
}
