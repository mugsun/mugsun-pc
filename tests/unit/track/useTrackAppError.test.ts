import { describe, expect, it, vi } from 'vitest'
import { onMounted, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { withSetup } from '../helpers/withSetup'

// useTrackApp 依赖 unplugin-auto-import 注入的全局
vi.stubGlobal('ref', ref)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('useLocalStorage', useLocalStorage)

const flushPromises = () => new Promise((r) => setTimeout(r, 0))

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const fetchTrackAppPage = vi.fn()
vi.mock('@/api/track', () => ({ fetchTrackAppPage: (...a: unknown[]) => fetchTrackAppPage(...a) }))

import { HttpError, isNetworkError } from '@/utils/http/error'
import { ApiStatus } from '@/utils/http/status'

describe('useTrackApp 网络错误态（UX-009）', () => {
  it('应用列表加载失败时记下错误、不上抛；重试成功后清掉', async () => {
    fetchTrackAppPage.mockRejectedValueOnce(
      new HttpError('httpMsg.networkError', ApiStatus.network, { errorKind: 'network' })
    )
    // 全局桩就位后再加载（模块顶层即用到 ref / useLocalStorage）
    const { useTrackApp } = await import('../../../modules/track/views/shared/useTrackApp')
    const { result, app } = withSetup(() => useTrackApp())
    await flushPromises()
    expect(isNetworkError(result.appsError.value)).toBe(true)

    fetchTrackAppPage.mockResolvedValueOnce({ records: [{ appName: 'A', appKey: 'k' }] })
    await result.loadApps()
    expect(result.appsError.value).toBeNull()
    expect(result.appOptions.value).toEqual([{ label: 'A', value: 'k' }])
    app.unmount()
  })
})
