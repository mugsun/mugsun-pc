import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// user store 依赖自动导入，单测环境无法直接实例化，这里对源码做静态断言
const src = readFileSync(resolve(__dirname, '../../../src/store/modules/user.ts'), 'utf8')
const lockVue = readFileSync(
  resolve(__dirname, '../../../src/components/core/layouts/art-screen-lock/index.vue'),
  'utf8'
)

describe('锁屏校验值不进 pinia 持久化状态', () => {
  it('store 不再有 lockPassword / setLockPassword', () => {
    expect(src).not.toMatch(/lockPassword|setLockPassword/)
  })

  it('persist 的 pick 只含非锁屏字段', () => {
    const picks = [...src.matchAll(/pick:\s*\[([^\]]*)\]/g)].map((m) => m[1])
    expect(picks.length).toBeGreaterThan(0)
    for (const p of picks) expect(p).not.toMatch(/lock|hash|salt/i)
  })

  it('登出时清掉锁屏校验值', () => {
    expect(src).toMatch(/clearLockSecret\(\)/)
  })

  it('锁屏组件不再引用固定混淆值，算 hash 前先清空明文输入', () => {
    expect(lockVue).not.toMatch(/VITE_LOCK_ENCRYPT_KEY|CryptoJS/)
    const lockIdx = lockVue.indexOf('await setLockSecret(password)')
    const clearIdx = lockVue.indexOf("formData.password = ''")
    expect(lockIdx).toBeGreaterThan(0)
    expect(clearIdx).toBeGreaterThan(0)
    expect(clearIdx).toBeLessThan(lockIdx)
  })
})
