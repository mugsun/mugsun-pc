/**
 * 锁屏 / 解锁流程的纯函数，便于单测断言调用顺序。
 *
 * - 先从表单取出明文并立即清空表单，再把明文交给 setSecret / verify
 * - setSecret 抛错时返回 false，调用方据此不锁屏并提示
 */
export interface PasswordForm {
  password: string
}

export async function lockFlow(
  form: PasswordForm,
  setSecret: (password: string) => Promise<void>
): Promise<boolean> {
  const password = form.password
  form.password = ''
  try {
    await setSecret(password)
    return true
  } catch (error) {
    console.error('锁屏失败:', error)
    return false
  }
}

export async function unlockFlow(
  form: PasswordForm,
  verify: (password: string) => Promise<boolean>
): Promise<boolean> {
  const password = form.password
  form.password = ''
  return verify(password)
}
