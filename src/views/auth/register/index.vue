<!-- 注册页面 -->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex flex-1 items-center justify-center overflow-hidden">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('register.title') }}</h3>
          <p class="sub-title">{{ $t('register.subTitle') }}</p>
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
                :placeholder="$t('register.placeholder.username')"
              />
            </ElFormItem>

            <ElFormItem prop="password">
              <ElInput
                class="custom-height"
                v-model.trim="formData.password"
                :placeholder="$t('register.placeholder.password')"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <ElFormItem prop="confirmPassword">
              <ElInput
                class="custom-height"
                v-model.trim="formData.confirmPassword"
                :placeholder="$t('register.placeholder.confirmPassword')"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <ElFormItem prop="phone">
              <ElInput
                class="custom-height"
                v-model.trim="formData.phone"
                :placeholder="$t('pages.auth.register.phonePlaceholder')"
                maxlength="11"
              />
            </ElFormItem>

            <!-- 验证码配置拿不到：错误态（可重试），不回落 -->
            <CaptchaConfigError :gate="captchaGate" scene="register" />

            <ElFormItem prop="agreement">
              <ElCheckbox v-model="formData.agreement">
                {{ $t('register.agreeText') }}
                <RouterLink
                  style="color: var(--theme-color); text-decoration: none"
                  to="/privacy-policy"
                  >{{ $t('register.privacyPolicy') }}</RouterLink
                >
              </ElCheckbox>
            </ElFormItem>

            <div style="margin-top: 15px">
              <ElButton
                class="w-full custom-height"
                type="primary"
                @click="register"
                :loading="loading"
                :disabled="!captchaGate.ready.value"
                v-ripple
              >
                {{ $t('register.submitBtnText') }}
              </ElButton>
            </div>

            <div class="mt-5 text-sm text-g-600">
              <span :class="{ 'mr-1': locale !== LanguageEnum.ZH }">{{
                $t('register.hasAccount')
              }}</span>
              <RouterLink class="text-theme" :to="{ name: 'Login' }">{{
                $t('register.toLogin')
              }}</RouterLink>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
    <CaptchaDialog
      v-model:visible="captchaGate.visible.value"
      scene="register"
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
  import { LanguageEnum } from '@/enums/appEnum'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { fetchRegister } from '@/api/auth'
  import { encryptPassword, isGmEncryptError } from '@/utils/gm'
  import CaptchaDialog from '@/components/core/captcha/CaptchaDialog.vue'
  import CaptchaConfigError from '@/components/core/captcha/CaptchaConfigError.vue'
  import {
    useCaptchaGate,
    isCaptchaCancelled,
    isCaptchaNotReady
  } from '@/hooks/core/useCaptchaGate'

  defineOptions({ name: 'Register' })

  interface RegisterForm {
    username: string
    password: string
    confirmPassword: string
    phone: string
    agreement: boolean
  }

  const USERNAME_MIN_LENGTH = 3
  const USERNAME_MAX_LENGTH = 20
  const PASSWORD_MIN_LENGTH = 6

  const { t, locale } = useI18n()
  const router = useRouter()
  const formRef = ref<FormInstance>()

  const loading = ref(false)
  const formKey = ref(0)

  // 监听语言切换，重置表单
  watch(locale, () => {
    formKey.value++
  })

  const formData = reactive<RegisterForm>({
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    agreement: false
  })

  // 验证码闸门（防批量注册，与登录同机制）：行为验证码 / 关闭；config 拿不到时显示错误态（不回落）
  const captchaGate = useCaptchaGate('register')
  onMounted(() => captchaGate.loadConfig())

  /**
   * 验证密码
   * 当密码输入后，如果确认密码已填写，则触发确认密码的验证
   */
  const validatePassword = (_rule: any, value: string, callback: (error?: Error) => void) => {
    if (!value) {
      callback(new Error(t('register.rule.passwordRequired')))
      return
    }

    if (formData.confirmPassword) {
      formRef.value?.validateField('confirmPassword')
    }

    callback()
  }

  /**
   * 验证确认密码
   * 检查确认密码是否与密码一致
   */
  const validateConfirmPassword = (
    _rule: any,
    value: string,
    callback: (error?: Error) => void
  ) => {
    if (!value) {
      callback(new Error(t('register.rule.confirmPasswordRequired')))
      return
    }

    if (value !== formData.password) {
      callback(new Error(t('register.rule.passwordMismatch')))
      return
    }

    callback()
  }

  /**
   * 验证用户协议
   * 确保用户已勾选同意协议
   */
  const validateAgreement = (_rule: any, value: boolean, callback: (error?: Error) => void) => {
    if (!value) {
      callback(new Error(t('register.rule.agreementRequired')))
      return
    }
    callback()
  }

  const rules = computed<FormRules<RegisterForm>>(() => ({
    username: [
      { required: true, message: t('register.rule.usernameRequired'), trigger: 'blur' },
      {
        min: USERNAME_MIN_LENGTH,
        max: USERNAME_MAX_LENGTH,
        message: t('register.rule.usernameLength'),
        trigger: 'blur'
      }
    ],
    password: [
      { required: true, validator: validatePassword, trigger: 'blur' },
      { min: PASSWORD_MIN_LENGTH, message: t('register.rule.passwordLength'), trigger: 'blur' }
    ],
    confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
    phone: [
      { pattern: /^1\d{10}$/, message: t('pages.auth.register.phoneInvalid'), trigger: 'blur' }
    ],
    agreement: [{ validator: validateAgreement, trigger: 'change' }]
  }))

  /**
   * 注册用户
   * 验证表单后提交注册请求
   */
  const register = async () => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()
      loading.value = true
      await captchaGate.run(async (captchaToken) =>
        fetchRegister({
          username: formData.username,
          password: await encryptPassword(formData.password),
          nickname: formData.username,
          phone: formData.phone || undefined,
          ...(captchaToken ? { captchaToken } : {})
        })
      )
      ElMessage.success(t('pages.auth.register.successMessage'))
      loading.value = false
      router.push({ name: 'Login' })
    } catch (error) {
      if (isCaptchaCancelled(error)) {
        loading.value = false
        return
      }
      if (isCaptchaNotReady(error)) {
        ElMessage.warning(t('pages.auth.captchaConfig.notReady'))
        loading.value = false
        return
      }
      console.error('注册失败:', error)
      if (isGmEncryptError(error)) {
        ElMessage.error(t('pages.auth.login.gmEncryptFailed'))
      }
      loading.value = false
    }
  }
</script>

<style scoped>
  @import '../login/style.css';
</style>
