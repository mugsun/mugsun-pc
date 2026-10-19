import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackSetupOptionsFromEnv } from '@/plugins/track'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('VITE_TRACK_SKIP_HANDLED_ERRORS', () => {
  it('未设置或为空时不传 skipHandledErrors', () => {
    expect(trackSetupOptionsFromEnv({})).toEqual({})
    expect(trackSetupOptionsFromEnv({ VITE_TRACK_SKIP_HANDLED_ERRORS: '' })).toEqual({})
    expect(trackSetupOptionsFromEnv({ VITE_TRACK_SKIP_HANDLED_ERRORS: '  ' })).toEqual({})
    expect(Object.keys(trackSetupOptionsFromEnv({}))).not.toContain('skipHandledErrors')
  })

  it('true / false：trim 后不区分大小写', () => {
    for (const v of ['true', 'TRUE', ' True ', '\ttrue\n']) {
      expect(trackSetupOptionsFromEnv({ VITE_TRACK_SKIP_HANDLED_ERRORS: v })).toEqual({
        skipHandledErrors: true
      })
    }
    for (const v of ['false', 'FALSE', ' False ']) {
      expect(trackSetupOptionsFromEnv({ VITE_TRACK_SKIP_HANDLED_ERRORS: v })).toEqual({
        skipHandledErrors: false
      })
    }
  })

  it('其它值 console.warn 并且不传', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const v of ['1', '0', 'yes', 'no', 'tru e']) {
      expect(trackSetupOptionsFromEnv({ VITE_TRACK_SKIP_HANDLED_ERRORS: v })).toEqual({})
    }
    expect(warn).toHaveBeenCalledTimes(5)
    expect(String(warn.mock.calls[0][0])).toContain('VITE_TRACK_SKIP_HANDLED_ERRORS')
  })
})
