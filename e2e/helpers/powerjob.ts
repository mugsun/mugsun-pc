import { execFileSync } from 'node:child_process'
import { Socket } from 'node:net'

/**
 * e2e 主套前置：PowerJob Server(7700) 须可达（W4-3 要走「建任务 → 立即执行 → Worker 真清 Redis 键」全链路）。
 *
 * 默认只检查 7700，不通就报错，不动任何容器。
 * 显式设 E2E_START_POWERJOB=1 时才 docker start 容器，容器名取
 * E2E_POWERJOB_CONTAINERS（逗号分隔，默认 powerjob-mysql,powerjob-server）。
 * captcha-on 套件（playwright.captcha-on.config.ts）不走这个 globalSetup，不需要 PowerJob。
 */
const PRECONDITION =
  'PowerJob Server(7700) 未就绪：W4-3 无法验收定时任务全链路。' +
  '请先启动 PowerJob Server，并以 --powerjob.worker.enabled=true 启动 mugsun-boot；' +
  '或设 E2E_START_POWERJOB=1（容器名可用 E2E_POWERJOB_CONTAINERS 指定）让 e2e 代为 docker start。'

export default async function globalSetup(): Promise<void> {
  if (await portOpen(7700)) {
    console.log('[e2e] PowerJob Server 7700 已就绪')
    return
  }
  if (process.env.E2E_START_POWERJOB !== '1') {
    throw new Error(PRECONDITION)
  }
  const names = (process.env.E2E_POWERJOB_CONTAINERS || 'powerjob-mysql,powerjob-server')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
  console.log(`[e2e] E2E_START_POWERJOB=1：docker start ${names.join(' ')} …`)
  for (const name of names) {
    try {
      execFileSync('docker', ['start', name], { stdio: 'inherit' })
    } catch {
      console.warn(`[e2e] 容器 ${name} 不存在或启动失败`)
    }
  }
  for (let i = 0; i < 30; i++) {
    if (await portOpen(7700)) {
      console.log('[e2e] PowerJob Server 7700 已就绪')
      return
    }
    await sleep(1000)
  }
  throw new Error(PRECONDITION)
}

/** TCP 连通性检查（不依赖 HTTP 状态码：PowerJob 根路径返回什么都算可达） */
function portOpen(port: number, host = '127.0.0.1', timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket()
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
