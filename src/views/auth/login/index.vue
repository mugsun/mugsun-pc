<!-- 登录页面 -->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex flex-1 items-center justify-center overflow-hidden">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('login.title') }}</h3>
          <p class="sub-title">{{ $t('login.subTitle') }}</p>

          <ElTabs v-model="loginType" class="login-tabs">
            <ElTabPane :label="$t('pages.auth.login.accountTab')" name="account" />
            <ElTabPane :label="$t('pages.auth.login.smsTab')" name="sms" />
          </ElTabs>

          <!-- 账号密码登录 -->
          <ElForm
            v-if="loginType === 'account'"
            ref="formRef"
            :model="formData"
            :rules="rules"
            :key="formKey"
            @keyup.enter="handleSubmit"
          >
            <ElFormItem prop="username">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.username')"
                v-model.trim="formData.username"
              />
            </ElFormItem>
            <ElFormItem prop="password">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.password')"
                v-model.trim="formData.password"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <!-- 租户编号（多租户登录；留空为平台租户） -->
            <ElFormItem prop="tenantId">
              <ElInput
                class="custom-height"
                :placeholder="$t('pages.auth.tenantPlaceholder')"
                v-model.trim="formData.tenantId"
                maxlength="12"
              />
            </ElFormItem>

            <!-- 图形验证码（旧数字码，config.type 非 SLIDER 时保留） -->
            <ElFormItem v-if="captchaGate.legacyEnabled.value" prop="captchaCode">
              <div class="flex w-full gap-2">
                <ElInput
                  class="custom-height"
                  :placeholder="$t('pages.auth.login.captchaCodePlaceholder')"
                  v-model.trim="formData.captchaCode"
                  maxlength="4"
                />
                <img
                  v-if="captchaImage"
                  :src="captchaImage"
                  class="captcha-img"
                  :title="$t('pages.auth.captchaRefresh')"
                  :alt="$t('pages.auth.captchaAlt')"
                  @click="loadCaptcha"
                />
                <div
                  v-else
                  class="captcha-img captcha-reload"
                  :title="$t('pages.auth.captchaReload')"
                  @click="loadCaptcha"
                >
                  {{ $t('pages.auth.captchaLoadFailed') }}
                </div>
              </div>
            </ElFormItem>

            <div class="flex-cb mt-2 text-sm">
              <ElCheckbox v-model="formData.rememberPassword">{{
                $t('login.rememberPwd')
              }}</ElCheckbox>
              <RouterLink class="text-theme" :to="{ name: 'ForgetPassword' }">{{
                $t('login.forgetPwd')
              }}</RouterLink>
            </div>

            <div class="login-submit-wrap">
              <ElButton
                class="w-full custom-height"
                type="primary"
                @click="handleSubmit"
                :loading="loading"
                v-ripple
              >
                {{ $t('login.btnText') }}
              </ElButton>
            </div>
          </ElForm>

          <!-- 短信验证码登录 -->
          <ElForm
            v-else
            ref="smsFormRef"
            :model="smsForm"
            :rules="smsRules"
            @keyup.enter="handleSmsSubmit"
            style="margin-top: 8px"
          >
            <ElFormItem prop="phone">
              <ElInput
                class="custom-height"
                :placeholder="$t('pages.auth.login.phonePlaceholder')"
                v-model.trim="smsForm.phone"
                maxlength="11"
              />
            </ElFormItem>
            <ElFormItem prop="code">
              <div class="flex w-full gap-2">
                <ElInput
                  class="custom-height"
                  :placeholder="$t('pages.auth.login.smsCodePlaceholder')"
                  v-model.trim="smsForm.code"
                  maxlength="6"
                />
                <ElButton
                  class="custom-height sms-code-btn"
                  :disabled="smsCountdown > 0"
                  @click="sendSmsCode"
                >
                  {{ smsCountdown > 0 ? smsCountdown + 's' : $t('pages.auth.sendCode') }}
                </ElButton>
              </div>
            </ElFormItem>
            <ElFormItem v-if="captchaGate.legacyEnabled.value" prop="captchaCode">
              <div class="flex w-full gap-2">
                <ElInput
                  class="custom-height"
                  :placeholder="$t('pages.auth.captchaPlaceholder')"
                  v-model.trim="smsForm.captchaCode"
                  maxlength="4"
                />
                <img
                  v-if="captchaImage"
                  :src="captchaImage"
                  class="captcha-img"
                  :title="$t('pages.auth.captchaRefresh')"
                  :alt="$t('pages.auth.captchaAlt')"
                  @click="loadCaptcha"
                />
                <div
                  v-else
                  class="captcha-img captcha-reload"
                  :title="$t('pages.auth.captchaReload')"
                  @click="loadCaptcha"
                >
                  {{ $t('pages.auth.captchaLoadFailed') }}
                </div>
              </div>
            </ElFormItem>

            <div class="login-submit-wrap">
              <ElButton
                class="w-full custom-height"
                type="primary"
                @click="handleSmsSubmit"
                :loading="loading"
                v-ripple
              >
                {{ $t('login.btnText') }}
              </ElButton>
            </div>
          </ElForm>

          <!-- 第三方登录：按 /auth/social/sources 动态渲染（有真实源显示真实按钮、无则整区隐藏；mock 维持 DEV-only） -->
          <div class="social-login" v-if="showSocialArea">
            <ElDivider>{{ $t('pages.auth.login.socialDivider') }}</ElDivider>
            <ElButton
              v-for="src in socialSources"
              :key="src"
              class="w-full custom-height social-btn"
              @click="handleSocialLogin(src)"
              v-ripple
            >
              {{ $t('pages.auth.login.socialBtn', { name: socialLabel(src) }) }}
            </ElButton>
            <ElButton
              v-if="showMockSocial && socialMockAllowed"
              class="w-full custom-height social-btn"
              @click="handleSocialLogin('mock')"
              v-ripple
            >
              {{ $t('pages.auth.login.mockSocialBtn') }}
            </ElButton>
          </div>

          <div class="mt-5 text-sm text-g-600 register-hint">
            <span>{{ $t('login.noAccount') }}</span>
            <RouterLink class="text-theme" :to="{ name: 'Register' }">{{
              $t('login.register')
            }}</RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- 滑块验证码弹层：账号登录（scene=login） -->
    <SliderCaptcha
      v-model:visible="captchaGate.visible.value"
      scene="login"
      :client-id="captchaGate.clientId"
      :tenant-id="captchaGate.tenantId.value"
      @success="captchaGate.onSuccess"
      @skip="captchaGate.onSkip"
      @close="captchaGate.onClose"
    />
    <!-- 滑块验证码弹层：发送短信验证码（scene=sms，sms-login 不再需要 token） -->
    <SliderCaptcha
      v-model:visible="smsGate.visible.value"
      scene="sms"
      :client-id="smsGate.clientId"
      :tenant-id="smsGate.tenantId.value"
      @success="smsGate.onSuccess"
      @skip="smsGate.onSkip"
      @close="smsGate.onClose"
    />
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import { useUserStore } from '@/store/modules/user'
  import { useI18n } from 'vue-i18n'
  import { HttpError } from '@/utils/http/error'
  import { fetchLogin, fetchCaptcha, fetchTwoFactor, fetchSmsCode, fetchSmsLogin } from '@/api/auth'
  import { encryptPassword, isGmEncryptError } from '@/utils/gm'
  import { fetchSocialRender, fetchSocialSources } from '@/api/auth'
  import SliderCaptcha from '@/components/core/captcha/SliderCaptcha.vue'
  import { useCaptchaGate, isCaptchaCancelled } from '@/hooks/core/useCaptchaGate'
  import { classifyCaptchaError } from '@/utils/captcha'
  import { connectMessageSocket } from '@/utils/socket'
  import { trackIdentify } from '@/plugins/track'
  import { resetRouterStateImmediate } from '@/router/guards/beforeEach'
  import {
    ElNotification,
    ElMessage,
    ElMessageBox,
    type FormInstance,
    type FormRules
  } from 'element-plus'

  defineOptions({ name: 'Login' })

  const { t, locale } = useI18n()
  const formKey = ref(0)

  // 监听语言切换，重置表单
  watch(locale, () => {
    formKey.value++
  })

  const userStore = useUserStore()
  const router = useRouter()
  const route = useRoute()

  const systemName = AppConfig.systemInfo.name
  const formRef = ref<FormInstance>()
  // mock 社交登录按钮仅 dev 展示（mock 来源身份固定，生产构建绝不出现）
  const showMockSocial = import.meta.env.DEV

  // ===== 第三方登录：按 /auth/social/sources 动态渲染 =====
  const socialSources = ref<string[]>([])
  const socialMockAllowed = ref(false)
  // 有真实源显示真实按钮，无源且 mock 不可用整区隐藏
  const showSocialArea = computed(
    () => socialSources.value.length > 0 || (showMockSocial && socialMockAllowed.value)
  )
  const SOCIAL_LABELS = computed<Record<string, string>>(() => ({
    github: 'GitHub',
    gitee: 'Gitee',
    qq: 'QQ',
    wechat_open: t('pages.auth.login.wechat')
  }))
  const socialLabel = (source: string) => SOCIAL_LABELS.value[source] || source
  const loadSocialSources = async () => {
    try {
      const data = await fetchSocialSources()
      socialSources.value = data.sources || []
      socialMockAllowed.value = !!data.mockEnabled
    } catch {
      // 获取失败按无源处理（整区隐藏，不阻断登录主流程）
      socialSources.value = []
      socialMockAllowed.value = false
    }
  }

  const captchaImage = ref('')

  /** 记住账号：仅持久化用户名（不落密码，防凭据泄露），下次登录自动回填 */
  const REMEMBERED_USERNAME_KEY = 'mugsun.remembered-username'

  const formData = reactive({
    username: '',
    password: '',
    tenantId: '',
    captchaUuid: '',
    captchaCode: '',
    rememberPassword: false
  })

  // 验证码闸门：滑块（SLIDER）/ 旧数字码（IMAGE 或旧后端）/ 关闭
  const captchaGate = useCaptchaGate('login', { tenantId: () => formData.tenantId })
  const smsGate = useCaptchaGate('sms', { tenantId: () => formData.tenantId })

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: t('login.placeholder.username'), trigger: 'blur' }],
    password: [{ required: true, message: t('login.placeholder.password'), trigger: 'blur' }],
    captchaCode: captchaGate.legacyEnabled.value
      ? [{ required: true, message: t('pages.auth.login.captchaRequired'), trigger: 'blur' }]
      : []
  }))

  const loading = ref(false)

  // ===== 短信登录 =====
  const loginType = ref<'account' | 'sms'>('account')
  const smsFormRef = ref<FormInstance>()
  const smsForm = reactive({ phone: '', code: '', captchaCode: '' })
  const smsRules = computed<FormRules>(() => ({
    phone: [
      { required: true, message: t('pages.auth.login.phonePlaceholder'), trigger: 'blur' },
      { pattern: /^1\d{10}$/, message: t('pages.auth.phoneInvalid'), trigger: 'blur' }
    ],
    code: [{ required: true, message: t('pages.auth.login.smsCodePlaceholder'), trigger: 'blur' }],
    captchaCode: captchaGate.legacyEnabled.value
      ? [{ required: true, message: t('pages.auth.captchaPlaceholder'), trigger: 'blur' }]
      : []
  }))
  const smsCountdown = ref(0)
  let smsTimer: ReturnType<typeof setInterval> | null = null
  const startSmsCountdown = (seconds: number) => {
    if (smsTimer) clearInterval(smsTimer)
    smsCountdown.value = Math.max(0, Math.ceil(seconds))
    if (smsCountdown.value <= 0) return
    smsTimer = setInterval(() => {
      smsCountdown.value--
      if (smsCountdown.value <= 0 && smsTimer) {
        clearInterval(smsTimer)
        smsTimer = null
      }
    }, 1000)
  }

  // 切换登录方式刷新图形验证码（一次性即焚，两 Tab 共用同一 captcha 状态）
  watch(loginType, () => {
    loadCaptcha()
    smsForm.captchaCode = ''
  })

  // 存储 token 并跳转（账号/短信登录共用）
  const applyToken = (token?: string, refreshToken?: string) => {
    if (!token) throw new Error('Login failed - no token received')
    userStore.setToken(token, refreshToken)
    userStore.setLoginStatus(true)
    // 取消登出延迟清理并重置动态路由，确保守卫重新拉菜单注册（避免重登后 404）
    resetRouterStateImmediate()
    // 埋点身份绑定兜底：快速路径（动态路由已注册时守卫不再拉取用户信息）用已缓存信息即时绑定；
    // 常规路径由路由守卫 fetchUserInfo 后 identify（SDK 幂等，重复绑定无副作用）
    const cachedUserId = userStore.getUserInfo.userId
    if (cachedUserId) trackIdentify(cachedUserId)
    // 建立消息推送长连接
    connectMessageSocket()
    showLoginSuccessNotice()
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  }

  // 发起第三方登录：取授权地址并跳转（回调页处理 code+state）
  const handleSocialLogin = async (source: string) => {
    try {
      const { authorizeUrl } = await fetchSocialRender(source)
      window.location.href = authorizeUrl
    } catch (e: any) {
      ElMessage.error(e?.message || t('pages.auth.login.socialLoginFailed'))
    }
  }

  // 发送短信验证码（开发环境后端回显，自动填充）
  const sendSmsCode = async () => {
    if (!/^1\d{10}$/.test(smsForm.phone)) {
      ElMessage.warning(t('pages.auth.login.enterValidPhone'))
      return
    }
    try {
      // 滑块拦在发短信这一步（短信登录提交本身不再弹滑块）
      await smsGate.loadConfig()
      const resp = await smsGate.run((captchaToken) => fetchSmsCode(smsForm.phone, captchaToken))
      smsCountdown.value = 60
      smsTimer = setInterval(() => {
        smsCountdown.value--
        if (smsCountdown.value <= 0 && smsTimer) {
          clearInterval(smsTimer)
          smsTimer = null
        }
      }, 1000)
      if (resp?.code) {
        smsForm.code = resp.code
        ElMessage.success(t('pages.auth.login.smsCodeSentEcho', { code: resp.code }))
      } else {
        ElMessage.success(t('pages.auth.login.smsCodeSent'))
      }
    } catch (error) {
      if (isCaptchaCancelled(error)) return
      // sms-code 频控 40012：按 retryAfter 禁用发送按钮并倒计时
      const info = classifyCaptchaError(error)
      if (info.kind === 'rateLimited') {
        startSmsCountdown(info.retryAfter ?? 60)
        ElMessage.warning(info.msg || t('pages.auth.slider.limited', { s: info.retryAfter ?? 60 }))
        return
      }
      console.error('[Login] send sms code failed:', error)
    }
  }

  // 短信登录提交
  const handleSmsSubmit = async () => {
    if (!smsFormRef.value) return
    try {
      const valid = await smsFormRef.value.validate()
      if (!valid) return
      loading.value = true
      const resp = await fetchSmsLogin({
        phone: smsForm.phone,
        code: smsForm.code,
        ...(captchaGate.legacyEnabled.value
          ? { captchaUuid: formData.captchaUuid, captchaCode: smsForm.captchaCode }
          : {})
      })
      applyToken(resp.token, resp.refreshToken)
    } catch (error) {
      // 失败刷新图形验证码（答案已在后端消费；show-code 时 loadCaptcha 会回填）
      loadCaptcha()
      if (!(error instanceof HttpError)) {
        console.error('[Login] sms login error:', error)
        if (isGmEncryptError(error)) {
          ElMessage.error(t('pages.auth.login.gmEncryptFailed'))
        }
      }
    } finally {
      loading.value = false
    }
  }

  onUnmounted(() => {
    if (smsTimer) clearInterval(smsTimer)
  })

  // 加载图形验证码（仅旧数字码模式）
  const loadCaptcha = async () => {
    if (!captchaGate.legacyEnabled.value) return
    try {
      const data = await fetchCaptcha()
      captchaImage.value = data.captchaImage
      formData.captchaUuid = data.captchaUuid
      const echo = data.captchaCode ?? ''
      formData.captchaCode = echo
      smsForm.captchaCode = echo
    } catch (error) {
      console.error('[Login] load captcha failed:', error)
    }
  }

  onMounted(() => {
    // 回填记住的账号（仅用户名，密码绝不持久化）
    const remembered = localStorage.getItem(REMEMBERED_USERNAME_KEY)
    if (remembered) {
      formData.username = remembered
      formData.rememberPassword = true
    } else if (import.meta.env.DEV) {
      // 仅开发环境预填演示账号（生产构建绝不携带默认凭据）
      formData.username = 'admin'
      formData.password = '123456'
    }
    captchaGate.loadConfig().then(() => loadCaptcha())
    smsGate.loadConfig()
    loadSocialSources()
  })

  // 登录
  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      // 表单验证
      const valid = await formRef.value.validate()
      if (!valid) return

      loading.value = true

      // 登录请求
      const { username, password, tenantId, captchaUuid, captchaCode } = formData

      const legacy = captchaGate.legacyEnabled.value
      const resp = await captchaGate.run(async (captchaToken) =>
        fetchLogin({
          username,
          password: await encryptPassword(password),
          tenantId: tenantId || undefined,
          ...(legacy ? { captchaUuid, captchaCode } : {}),
          ...(captchaToken ? { captchaToken } : {})
        })
      )

      // 记住账号：勾选则持久化用户名，未勾选清除
      if (formData.rememberPassword) {
        localStorage.setItem(REMEMBERED_USERNAME_KEY, username)
      } else {
        localStorage.removeItem(REMEMBERED_USERNAME_KEY)
      }

      let token = resp.token
      let refreshToken = resp.refreshToken

      // 双因子登录：需二次验证码
      if (resp.twoFactorRequired) {
        const { value: code } = await ElMessageBox.prompt(
          t('pages.auth.login.twoFactorMessage'),
          t('pages.auth.login.twoFactorTitle'),
          {
            confirmButtonText: t('pages.auth.login.twoFactorConfirm'),
            cancelButtonText: t('common.cancel'),
            inputValue: resp.twoFactorCode || ''
          }
        )
        const tf = await fetchTwoFactor({ twoFactorToken: resp.twoFactorToken as string, code })
        token = tf.token
        refreshToken = tf.refreshToken
      }

      // 验证并存储 token，跳转
      applyToken(token, refreshToken)
    } catch (error) {
      // 用户关闭滑块：静默
      if (isCaptchaCancelled(error)) return
      // 登录失败刷新验证码（答案已在后端消费）
      loadCaptcha()
      if (error instanceof HttpError) {
        return
      }
      console.error('[Login] Unexpected error:', error)
      if (isGmEncryptError(error)) {
        ElMessage.error(t('pages.auth.login.gmEncryptFailed'))
      }
    } finally {
      loading.value = false
    }
  }

  // 登录成功提示
  const showLoginSuccessNotice = () => {
    setTimeout(() => {
      ElNotification({
        title: t('login.success.title'),
        type: 'success',
        duration: 2500,
        zIndex: 10000,
        message: `${t('login.success.message')}, ${systemName}!`
      })
    }, 1000)
  }
</script>

<style scoped>
  @import './style.css';
</style>

<style lang="scss" scoped>
  :deep(.el-select__wrapper) {
    height: 40px !important;
  }

  .sms-code-btn {
    flex-shrink: 0;
    width: 125px;
  }

  /* 第三方登录按钮纵向堆叠：清掉 el-button 相邻左间距，整行独占 */
  .social-btn {
    margin: 8px 0 0;
  }
</style>
