import { describe, expect, it } from 'vitest'
import { hasTrackApiError } from '../../../modules/track/error-filter'

describe('hasTrackApiError', () => {
  it('旧版 SDK 没有该方法时返回 false', () => {
    expect(hasTrackApiError({ track: () => {} })).toBe(false)
    expect(hasTrackApiError(null)).toBe(false)
    expect(hasTrackApiError({ trackApiError: () => {} })).toBe(true)
  })
})
