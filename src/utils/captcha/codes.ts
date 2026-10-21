/**
 * 行为验证码错误码，无依赖，供 e2e 直接引用。
 */

/** 错误码（R.code） */
export const CaptchaCode = {
  EXPIRED: 40010,
  FAILED: 40011,
  RATE_LIMITED: 40012,
  REQUIRED: 40013,
  DISABLED: 40014,
  /** v0.6.1：keyboard 取题时租户未启用 SLIDER/ROTATE（不自动重试，提示改用鼠标/触屏） */
  NO_ACCESSIBLE: 40015,
  /** v0.6.3：租户启用题型因素材不可用全部被剔除（仅 pointer challenge），不自动重试 */
  UNAVAILABLE: 40016
} as const
