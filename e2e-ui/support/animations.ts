import type { Page } from '@playwright/test'

/** 无限循环动画所在节点（转圈 loading、骨架屏、呼吸徽标）：永远不会停，等待时排除 */
export const INFINITE_ANIM_SELECTOR =
  '.is-loading, .el-loading-mask, .el-skeleton, .el-badge, [class*="loading"], [class*="skeleton"], [class*="pulse"], [class*="breath"]'

/**
 * 等有限动画结束：排除 iterations=Infinity 和上面这些节点上的动画。
 * 超时不判失败，直接继续（调用方另有 DOM 稳定或可见性断言兜底）。
 */
export async function waitFiniteAnimations(page: Page, timeout = 5_000) {
  await page
    .waitForFunction(
      (sel) =>
        document.getAnimations().every((a) => {
          if (a.playState !== 'running') return true
          const t = a.effect?.getComputedTiming()
          if (t && t.iterations === Infinity) return true
          const el = (a.effect as KeyframeEffect | null)?.target as Element | null
          return !!el?.closest?.(sel)
        }),
      INFINITE_ANIM_SELECTOR,
      { timeout }
    )
    .catch(() => {})
}
