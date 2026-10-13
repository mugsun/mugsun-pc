import { describe, expect, it, vi } from 'vitest'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'
import {
  isNeutralTileReason,
  isProxyEmptyTile,
  TileHealth,
  tileHealthFor,
  TILE_FAIL_THRESHOLD,
  watchCesiumImagery
} from '@/gis/tileHealth'

function run(h: TileHealth, seq: string) {
  for (const c of seq) {
    if (c === 's') h.start()
    else if (c === 'o') h.success()
    else if (c === 'x') h.fail()
  }
}

describe('瓦片健康度', () => {
  it('连续失败达到阈值才提示，任一成功立即恢复', () => {
    const h = new TileHealth()
    const seen: string[] = []
    h.subscribe((s) => seen.push(s))
    run(h, 'so') // 首张成功，之后不再走“首屏全失败”
    for (let i = 0; i < TILE_FAIL_THRESHOLD - 1; i++) run(h, 'sx')
    expect(h.state).toBe('ok')
    run(h, 'sx')
    expect(h.state).toBe('failing')
    run(h, 'so')
    expect(h.state).toBe('ok')
    expect(seen).toEqual(['ok', 'failing', 'ok'])
  })

  it('中途有成功会把连续失败清零', () => {
    const h = new TileHealth(3)
    run(h, 'sosxsxsosxsx')
    expect(h.state).toBe('ok')
  })

  it('首屏一张都没成功且已全部失败时提示（不足阈值也算）', () => {
    const h = new TileHealth()
    run(h, 'sss')
    run(h, 'xx')
    expect(h.state).toBe('ok') // 还有一张在途
    run(h, 'x')
    expect(h.state).toBe('failing')
  })

  it('重试会清零并调用注册的刷新函数', () => {
    const h = new TileHealth(1)
    const refresh = vi.fn()
    h.setRetry(refresh)
    run(h, 'sx')
    expect(h.state).toBe('failing')
    h.retry()
    expect(h.state).toBe('ok')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('越界等预期无图不计失败；记录最近失败原因，重置后清空', () => {
    const h = new TileHealth(2)
    h.start()
    h.start()
    h.neutral()
    h.fail('blocked-address')
    expect(h.state).toBe('ok') // 一张越界 + 一张失败，不算首屏全失败
    h.start()
    h.fail('timeout')
    expect(h.state).toBe('failing')
    expect(h.lastReason).toBe('timeout')
    h.reset()
    expect(h.lastReason).toBeUndefined()
  })

  it('只有 out-of-range 视为预期无图', () => {
    expect(isNeutralTileReason('out-of-range')).toBe(true)
    expect(isNeutralTileReason('blocked-address')).toBe(false)
    expect(isNeutralTileReason(null)).toBe(false)
  })

  it('按地图容器各记一份', () => {
    const a = {}
    const b = {}
    expect(tileHealthFor(a)).toBe(tileHealthFor(a))
    expect(tileHealthFor(a)).not.toBe(tileHealthFor(b))
  })

  it('识别代理回的空白瓦片（Cache-Control: no-store）', () => {
    expect(isProxyEmptyTile('no-store')).toBe(true)
    expect(isProxyEmptyTile('private, max-age=86400')).toBe(false)
    expect(isProxyEmptyTile(null)).toBe(false)
  })

  it('Cesium：包装 requestImage 统计成败，节流（undefined）不计', async () => {
    const h = new TileHealth(2)
    let mode: 'ok' | 'fail' | 'throttle' = 'fail'
    const imagery = {
      requestImage: () =>
        mode === 'throttle'
          ? undefined
          : mode === 'ok'
            ? Promise.resolve({})
            : Promise.reject(new Error('x'))
    }
    watchCesiumImagery(imagery, h)
    mode = 'throttle'
    imagery.requestImage()
    mode = 'fail'
    await imagery.requestImage()?.catch(() => {})
    await imagery.requestImage()?.catch(() => {})
    await Promise.resolve()
    expect(h.state).toBe('failing')
    mode = 'ok'
    await imagery.requestImage()
    await Promise.resolve()
    expect(h.state).toBe('ok')
  })

  it('中英文文案齐全且不含需要转义的字符', () => {
    const zk = zh.pages.gis.tileError as Record<string, string>
    const ek = en.pages.gis.tileError as Record<string, string>
    expect(Object.keys(zk).sort()).toEqual(Object.keys(ek).sort())
    for (const [k, v] of [...Object.entries(zk), ...Object.entries(ek)]) {
      if (k === 'reason') {
        // 唯一允许的占位符
        expect(v.replace('{code}', '')).not.toMatch(/[{}@|]/)
        continue
      }
      expect(v).not.toMatch(/[{}@|]/)
    }
  })
})
