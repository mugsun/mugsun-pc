<!-- 忘记密码：邮箱验证码重置（账号 → 发码 → 验证码+新密码 → 重置成功回登录） -->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex flex-1 items-center justify-center overflow-hidden">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('forgetPassword.title') }}</h3>
          <p class="sub-title">{{ $t('pages.auth.forgetPassword.subTitle') }}</p>

          <ElForm
            class="mt-7.5"
            ref="formRef"
            :model="formData"
            :rules="rules"
            label-position="top"
            :key="formKey"
          >
            <ElFormItem prop="username">
              <ElInput
                class="custom-height"
                v-model.trim="formData.username"
                :placeholder="$t('login.placeholder.username')"
              />
            </ElFormItem>

            <ElFormItem prop="tenantId">
              <ElInput
                class="custom-height"
                v-model.trim="formData.tenantId"
                :placeholder="$t('pages.auth.tenantPlaceholder')"
                maxlength="12"
              />
            </ElFormItem>

            <!-- 发码前的验证码配置拿不到：错误态（可重试），不回落 -->
            <CaptchaConfigError :gate="captchaGate" scene="forget" />

            <!-- 邮箱验证码：发码按钮带 60s 倒计时 -->
            <ElFormItem prop="code">
              <div class="flex w-full gap-2">
                <ElInput
                  class="custom-height"
                  v-model.trim="formData.code"
                  :placeholder="$t('pages.auth.forgetPassword.emailCodePlaceholder')"
                  maxlength="6"
                />
                <ElButton
                  class="custom-height mail-code-btn"
                  :disabled="countdown > 0 || !captchaGate.ready.value"
                  :loading="sending"
                  @click="sendCode"
                >
                  {{ countdown > 0 ? countdown + 's' : $t('pages.auth.sendCode') }}
                </ElButton>
              </div>
            </ElFormItem>

            <ElFormItem prop="newPassword">
              <ElInput
                class="custom-height"
                v-model.trim="formData.newPassword"
                :placeholder="$t('pages.auth.forgetPassword.newPasswordPlaceholder')"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <ElFormItem prop="confirmPassword">
              <ElInput
                class="custom-height"
                v-model.trim="formData.confirmPassword"
                :placeholder="$t('pages.auth.forgetPassword.confirmPasswordPlaceholder')"
                type="password"
                autocomplete="off"
                show-password
                @keyup.enter="submit"
              />
            </ElFormItem>

            <div style="margin-top: 15px">
              <ElButton
                class="w-full custom-height"
                type="primary"
                @click="submit"
                :loading="loading"
                v-ripple
              >
                {{ $t('forgetPassword.submitBtnText') }}
              </ElButton>
            </div>

            <div style="margin-top: 15px">
              <ElButton class="w-full custom-height" plain @click="toLogin">
                {{ $t('forgetPassword.backBtnText') }}
              </ElButton>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
    <CaptchaDialog
      v-model:visible="captchaGate.visible.value"
      scene="forget"
      :client-id="captchaGate.clientId"
      :tenant-id="captchaGate.tenantId.value"
      @success="captchaGate.onSuccess"
      @skip="captchaGate.onSkip"
      @close="captchaGate.onClose"
    />
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { fetchForgetCode, fetchForgetReset } from '@/api/auth'
  import { encryptPassword, isGmEncryptError } from '@/utils/gm'
  import CaptchaDialog from '@/components/core/captcha/CaptchaDialog.vue'
  import CaptchaConfigError from '@/components/core/captcha/CaptchaConfigError.vue'
  import {
    useCaptchaGate,
    isCaptchaCancelled,
    isCaptchaNotReady
  } from '@/hooks/core/useCaptchaGate'

  defineOptions({ name: 'ForgetPassword' })

  interface ForgetForm {
    username: string
    tenantId: string
    code: string
    newPassword: string
    confirmPassword: string
  }

  const { t, locale } = useI18n()
  const router = useRouter()
  const formRef = ref<FormInstance>()
  const formKey = ref(0)

  // 监听语言切换，重置表单
  watch(locale, () => {
    formKey.value++
  })

  const loading = ref(false)
  const sending = ref(false)

  const formData = reactive<ForgetForm>({
    username: '',
    tenantId: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  })

  // 验证码闸门（发码防爆破，与登录/注册同机制）：行为验证码 / 关闭；config 拿不到时显示错误态（不回落）
  const captchaGate = useCaptchaGate('forget', { tenantId: () => formData.tenantId })
  onMounted(() => captchaGate.loadConfig())

  // 发码倒计时（同短信登录 60s 节流）
  const countdown = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  const startCountdown = () => {
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && timer) {
        clearInterval(timer)
        timer = null
      }
    }, 1000)
  }
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  // 发送邮箱验证码：账号 + 行为验证码前置校验；账号不存在后端同样返回成功（防枚举）
  const sendCode = async () => {
    if (!formData.username) {
      ElMessage.warning(t('pages.auth.forgetPassword.enterUsernameFirst'))
      return
    }
    try {
      sending.value = true
      await captchaGate.run((captchaToken) =>
        fetchForgetCode({
          username: formData.username,
          tenantId: formData.tenantId || undefined,
          ...(captchaToken ? { captchaToken } : {})
        })
      )
      startCountdown()
      // v0.4：forget-code 永远成功，给中性提示（不暴露账号是否存在）
      ElMessage.info(t('pages.auth.forgetPassword.codeSent'))
    } catch (error) {
      if (isCaptchaCancelled(error)) return
      if (isCaptchaNotReady(error)) {
        ElMessage.warning(t('pages.auth.captchaConfig.notReady'))
        return
      }
      console.error('[ForgetPassword] send code failed:', error)
    } finally {
      sending.value = false
    }
  }

  const validateConfirmPassword = (
    _rule: any,
    value: string,
    callback: (error?: Error) => void
  ) => {
    if (!value) {
      callback(new Error(t('pages.auth.forgetPassword.confirmPasswordPlaceholder')))
      return
    }
    if (value !== formData.newPassword) {
      callback(new Error(t('pages.auth.forgetPassword.passwordMismatch')))
      return
    }
    callback()
  }

  const rules = computed<FormRules<ForgetForm>>(() => ({
    username: [
      { required: true, message: t('pages.auth.forgetPassword.resetRequired'), trigger: 'blur' }
    ],
    code: [
      {
        required: true,
        message: t('pages.auth.forgetPassword.resetRequired'),
        trigger: 'blur'
      }
    ],
    newPassword: [
      {
        required: true,
        message: t('pages.auth.forgetPassword.resetRequired'),
        trigger: 'blur'
      },
      {
        validator: (_r: unknown, v: string, cb: (e?: Error) => void) => {
          const kinds =
            Number(/[a-z]/.test(v || '')) +
            Number(/[A-Z]/.test(v || '')) +
            Number(/\d/.test(v || '')) +
            Number(/[^a-zA-Z0-9]/.test(v || ''))
          if (!v) {
            cb()
            return
          }
          if (v.length < 8 || kinds < 3) {
            cb(new Error(t('pages.auth.forgetPassword.passwordRule')))
          } else cb()
        },
        trigger: 'blur'
      }
    ],
    confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }]
  }))

  // 提交重置：新密码 SM2 传输；成功后回登录页用新密码登录
  const submit = async () => {
    if (!formRef.value) return
    try {
      await formRef.value.validate()
      loading.value = true
      await fetchForgetReset({
        username: formData.username,
        tenantId: formData.tenantId || undefined,
        code: formData.code,
        newPassword: await encryptPassword(formData.newPassword)
      })
      ElMessage.success(t('pages.auth.forgetPassword.resetSuccess'))
      router.push({ name: 'Login' })
    } catch (error) {
      console.error('[ForgetPassword] reset failed:', error)
      if (isGmEncryptError(error)) {
        ElMessage.error(t('pages.auth.login.gmEncryptFailed'))
      }
    } finally {
      loading.value = false
    }
  }

  const toLogin = () => {
    router.push({ name: 'Login' })
  }
</script>

<style scoped>
  @import '../login/style.css';

  .mail-code-btn {
    flex-shrink: 0;
    width: 125px;
  }
</style>
