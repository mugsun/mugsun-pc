import { execSync } from 'node:child_process'

/**
 * e2e 前置：确保 PowerJob Server(7700) 可达。
 *
 * W4-3 要走「建任务 → 立即执行 → Worker 真清 Redis 键」全链路；
 * Server 不在默认 docker compose 里，但本机通常已有 powerjob-server / powerjob-mysql 容器。
 * 7700 不通时尝试 docker start；仍不通则抛错并提示手动处理。
 */
export default async function globalSetup(): Promise<void> {
  if (portOpen(7700)) {
    console.log('[e2e] PowerJob Server 7700 已就绪')
    return
  }
  console.log('[e2e] 7700 未监听，尝试启动 powerjob-mysql / powerjob-server …')
  for (const name of ['powerjob-mysql', 'powerjob-server']) {
    try {
      execSync(`docker start ${name}`, { stdio: 'inherit' })
    } catch {
      console.warn(`[e2e] 容器 ${name} 不存在或启动失败（若从未创建请见 mugsun-boot/README.md）`)
    }
  }
  for (let i = 0; i < 30; i++) {
    if (portOpen(7700)) {
      console.log('[e2e] PowerJob Server 7700 已就绪')
      return
    }
    await sleep(1000)
  }
  throw new Error(
    'PowerJob Server(7700) 未就绪：W4-3 无法验收定时任务全链路。' +
      '请 docker start powerjob-mysql powerjob-server，并以 --powerjob.worker.enabled=true 启动 mugsun-boot。'
  )
}

function portOpen(port: number): boolean {
  try {
    execSync(`curl -sf -o /dev/null http://127.0.0.1:${port}/`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
