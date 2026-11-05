import { describe, expect, it } from 'vitest'
import {
  errorIssueReleaseFlagKey,
  errorIssueReleaseFlagTagType,
  errorIssueStatusKey,
  errorIssueStatusTagType,
  errorIssueSummary,
  isErrorIssueBackendMissing
} from '../../../modules/track/error-issue'

describe('error-issue helpers', () => {
  it('status / releaseFlag 映射到 i18n key 与 tag type', () => {
    expect(errorIssueStatusKey('OPEN')).toBe('open')
    expect(errorIssueStatusKey('ASSIGNED')).toBe('assigned')
    expect(errorIssueStatusKey('RESOLVED')).toBe('resolved')
    expect(errorIssueStatusKey('x')).toBe('unknown')
    expect(errorIssueStatusTagType('OPEN')).toBe('danger')
    expect(errorIssueStatusTagType('ASSIGNED')).toBe('warning')
    expect(errorIssueStatusTagType('RESOLVED')).toBe('success')

    expect(errorIssueReleaseFlagKey('NEW')).toBe('new')
    expect(errorIssueReleaseFlagKey('REGRESSED')).toBe('regressed')
    expect(errorIssueReleaseFlagKey('ONGOING')).toBe('ongoing')
    expect(errorIssueReleaseFlagKey(null)).toBeNull()
    expect(errorIssueReleaseFlagTagType('REGRESSED')).toBe('danger')
    expect(errorIssueReleaseFlagTagType('NEW')).toBe('success')
  })

  it('摘要优先 title，否则 message', () => {
    expect(errorIssueSummary({ title: 'A', message: 'B' })).toBe('A')
    expect(errorIssueSummary({ title: '  ', message: 'B' })).toBe('B')
    expect(errorIssueSummary({})).toBe('-')
  })

  it('404 判定覆盖 HttpError.code / bizCode / response.status', () => {
    expect(isErrorIssueBackendMissing({ code: 404 })).toBe(true)
    expect(isErrorIssueBackendMissing({ bizCode: 404 })).toBe(true)
    expect(isErrorIssueBackendMissing({ response: { status: 404 } })).toBe(true)
    expect(isErrorIssueBackendMissing({ code: 500 })).toBe(false)
    expect(isErrorIssueBackendMissing(null)).toBe(false)
  })
})
