<!-- 租户验证码设置：开关 + 启用题型（仅平台超管，后端鉴权）；保存响应 data.warning 原样展示 -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('pages.system.tenant.captchaTitle', { name: row?.tenantName || '' })"
    :width="narrow ? '92%' : '560px'"
    align-center
    destroy-on-close
  >
    <ElForm label-width="auto" :label-position="narrow ? 'top' : 'right'">
      <ElFormItem :label="$t('pages.system.tenant.captchaEnabled')">
        <ElSwitch v-model="enabled" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.captchaTypes')">
        <div class="captcha-hints">
          <ElCheckboxGroup v-model="types" :disabled="!enabled">
            <ElCheckbox v-for="tp in TENANT_CAPTCHA_TYPES" :key="tp" :value="tp">
              {{ $t(`pages.system.tenant.captchaType${tp}`) }}
            </ElCheckbox>
          </ElCheckboxGroup>
          <span>{{ $t('pages.system.tenant.captchaTypesHint') }}</span>
          <span data-testid="captcha-rotate-note">{{
            $t('pages.system.tenant.captchaRotateNote')
          }}</span>
          <span>{{ $t('pages.system.tenant.captchaLangNote') }}</span>
        </div>
      </ElFormItem>
    </ElForm>
    <ElAlert
      v-if="warning"
      data-testid="captcha-warning"
      type="warning"
      :title="$t('pages.system.tenant.captchaWarningTitle')"
      :description="warning"
      :closable="false"
      show-icon
    />
    <!-- 保存失败：弹窗内、按钮上方；前端文案 + 错误编号（X-Trace-Id），后端原文只进控制台 -->
    <div
      v-if="saveErrorId || saveNetworkError"
      class="captcha-save-error"
      data-testid="captcha-save-error"
    >
      <ElIcon class="captcha-save-error__icon" aria-hidden="true"><WarningFilled /></ElIcon>
      <p v-if="saveNetworkError" class="captcha-save-error__text">
        {{ $t('pages.system.tenant.captchaSaveNetworkError') }}
      </p>
      <p v-else class="captcha-save-error__text">
        {{ saveErrorLead
        }}<span class="captcha-save-error__id" data-testid="captcha-save-error-id">{{
          saveErrorIdPart
        }}</span>
      </p>
    </div>
    <!-- 读屏：失败时 polite 播报一次（不用 role=alert） -->
    <div class="captcha-save-sr" aria-live="polite" data-testid="captcha-save-live">{{
      liveText
    }}</div>
    <template #footer>
      <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="save">{{
        $t('pages.system.tenant.submit')
      }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useWindowSize } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { WarningFilled } from '@element-plus/icons-vue'
  import { newTraceId } from '@/utils/http/traceId'
  import { HttpError, isNetworkError } from '@/utils/http/error'
  import { ApiStatus } from '@/utils/http/status'
  import { fetchTenantCaptcha } from '@/api/system-manage'
  import {
    TENANT_CAPTCHA_TYPES,
    parseTenantCaptchaTypes,
    tenantCaptchaWarning
  } from '@/utils/captcha/tenantTypes'

  defineOptions({ name: 'TenantCaptchaDialog' })

  const props = defineProps<{ visible: boolean; row: Record<string, any> | null }>()
  const emit = defineEmits<{ 'update:visible': [boolean]; saved: [] }>()
  const { t } = useI18n()
  // 窄屏（≤768px）标签放到上方。注意：utils/form/responsive 的 xs 是 <768px，
  // 这里含 768（平板竖屏 768 宽也按窄屏处理），与租户列表的 narrow 一致
  const { width: winWidth } = useWindowSize()
  const narrow = computed(() => winWidth.value <= 768)

  const dialogVisible = computed({
    get: () => props.visible,
    set: (v) => emit('update:visible', v)
  })
  const enabled = ref(true)
  const types = ref<string[]>([])
  const warning = ref('')
  const saving = ref(false)
  /** 保存失败的错误编号（本次请求的 X-Trace-Id）；有值即显示弹窗内错误提示 */
  const saveErrorId = ref('')
  const liveText = ref('')
  /** 请求没到后端（网络异常 / 被取消或防重复提交拦截）：不给错误编号，提示检查网络 */
  const saveNetworkError = ref(false)

  // 分两段渲染：编号段整段不断开；中英间隔走 i18n 的 Sep（同 captchaConfig.idSep）
  const saveErrorLead = computed(
    () => t('pages.system.tenant.captchaSaveFailed') + t('pages.system.tenant.captchaSaveFailedSep')
  )
  const saveErrorIdPart = computed(() =>
    saveErrorId.value ? t('pages.system.tenant.captchaSaveFailedId', { id: saveErrorId.value }) : ''
  )

  function clearSaveError() {
    saveErrorId.value = ''
    saveNetworkError.value = false
    liveText.value = ''
  }

  watch(
    () => [props.visible, props.row] as const,
    ([v, row]) => {
      if (!v) clearSaveError() // 关闭弹窗即清掉错误提示
      if (!v || !row) return
      enabled.value = row.captchaEnabled !== 0
      types.value = parseTenantCaptchaTypes(row.captchaTypes)
      warning.value = ''
    },
    { immediate: true }
  )

  /**
   * 请求是否没到后端：errorKind=network（无响应），或被取消 / 防重复提交在前端拦下
   *（防重复提交：errorKind=http、code=ApiStatus.error 且没有 url——请求根本没发出；
   * 到过后端的 http/business 错误都带 url，401 的 code 是 unauthorized，不会落进来）
   */
  function notReachedBackend(error: unknown): boolean {
    if (isNetworkError(error)) return true
    if (!(error instanceof HttpError)) return false
    if (error.canceled) return true
    // 防重复提交拦截按形状识别，依赖三个条件同时成立：
    //   errorKind === 'http'、code === ApiStatus.error、没有 url（请求未发出）
    // TODO: 以后在请求层（utils/http）给防重复提交拦截加一个显式标记，
    //   再把这里的形状判断换成该标记；该改动单独提交、单独审。
    return error.errorKind === 'http' && error.code === ApiStatus.error && !error.url
  }

  async function save() {
    if (!props.row) return
    clearSaveError() // 再次提交先清掉上一次的错误
    saving.value = true
    const traceId = newTraceId()
    try {
      const data = await fetchTenantCaptcha(
        {
          id: props.row.id,
          enabled: enabled.value,
          types: TENANT_CAPTCHA_TYPES.filter((tp) => types.value.includes(tp))
        },
        { traceId }
      )
      emit('saved')
      warning.value = tenantCaptchaWarning(data)
      if (warning.value) return // 留在弹窗里让管理员看到后端提示
      ElMessage.success(t('pages.system.tenant.captchaSaved'))
      dialogVisible.value = false
    } catch (error) {
      // 后端原文只打到控制台；弹窗不关、勾选保留
      console.error('[TenantCaptcha] save failed', { traceId, error })
      if (notReachedBackend(error)) {
        saveNetworkError.value = true
        liveText.value = t('pages.system.tenant.captchaSaveNetworkError')
        return
      }
      saveErrorId.value = traceId
      liveText.value = saveErrorLead.value + saveErrorIdPart.value
    } finally {
      saving.value = false
    }
  }
</script>

<style lang="scss" scoped>
  .captcha-hints {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .captcha-save-error {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px 12px;
    margin-top: 4px;
    color: var(--el-text-color-primary);
    background: var(--el-color-danger-light-9);
    border: 1px solid var(--el-color-danger-light-7);
    border-radius: var(--el-border-radius-base);
  }

  .captcha-save-error__icon {
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 16px;
    color: var(--el-color-danger);
  }

  .captcha-save-error__text {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  /* 编号段整段换行，不在「（错误编号：」和编号之间断开（同 CaptchaConfigError） */
  .captcha-save-error__id {
    display: inline-block;
    max-width: 100%;
    color: var(--el-text-color-regular);
    overflow-wrap: anywhere;
  }

  .captcha-save-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
