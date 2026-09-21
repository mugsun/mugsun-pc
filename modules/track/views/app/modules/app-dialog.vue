<!-- 埋点应用新增/编辑弹窗（对接后端 /system/track/app/submit；appKey 由服务端生成） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? $t('pages.track.app.addApp') : $t('pages.track.app.editApp')"
    width="520px"
    align-center
    destroy-on-close
    class="track-app-dialog"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElFormItem :label="$t('pages.track.app.appName')" prop="appName">
        <ElInput
          v-model="formData.appName"
          :placeholder="$t('pages.track.app.appNamePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.sampleRate')" prop="sampleRate">
        <ElInputNumber v-model="formData.sampleRate" :min="1" :max="100" :step="5" :precision="0" />
        <span class="track-form-hint">{{ $t('pages.track.app.sampleRateHint') }}</span>
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.shared.enabled')" prop="enabled">
        <ElSwitch v-model="formData.enabled" :active-value="1" :inactive-value="0" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.maskSelectors')" prop="maskSelectors">
        <ElInput
          v-model="formData.maskSelectors"
          :placeholder="$t('pages.track.app.maskSelectorsPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.retentionDaysLabel')" prop="retentionDays">
        <ElInputNumber v-model="formData.retentionDays" :min="1" :max="3650" :precision="0" />
        <span class="track-form-hint">{{ $t('pages.track.app.unitDay') }}</span>
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.replayEnabledLabel')" prop="replayEnabled">
        <ElSwitch v-model="formData.replayEnabled" :active-value="1" :inactive-value="0" />
        <span class="track-form-hint">{{ $t('pages.track.app.replayHint') }}</span>
      </ElFormItem>
      <template v-if="formData.replayEnabled === 1">
        <ElFormItem :label="$t('pages.track.app.replaySampleRate')" prop="replaySampleRate">
          <ElInputNumber
            v-model="formData.replaySampleRate"
            :min="0"
            :max="100"
            :step="10"
            :precision="0"
          />
          <span class="track-form-hint">{{ $t('pages.track.app.replaySampleRateHint') }}</span>
        </ElFormItem>
        <ElFormItem :label="$t('pages.track.app.replayRetentionDays')" prop="replayRetentionDays">
          <ElInputNumber v-model="formData.replayRetentionDays" :min="1" :max="30" :precision="0" />
          <span class="track-form-hint">{{ $t('pages.track.app.retention30Hint') }}</span>
        </ElFormItem>
      </template>
      <ElFormItem :label="$t('pages.track.app.apiMonitor')" prop="apiMonitorEnabled">
        <ElSwitch v-model="formData.apiMonitorEnabled" :active-value="1" :inactive-value="0" />
        <span class="track-form-hint">{{ $t('pages.track.app.apiMonitorHint') }}</span>
      </ElFormItem>
      <template v-if="formData.apiMonitorEnabled === 1">
        <ElFormItem :label="$t('pages.track.app.apiBody')" prop="apiBodyEnabled">
          <ElSwitch v-model="formData.apiBodyEnabled" :active-value="1" :inactive-value="0" />
          <span class="track-form-hint">{{ $t('pages.track.app.apiBodyHint') }}</span>
        </ElFormItem>
        <template v-if="formData.apiBodyEnabled === 1">
          <ElFormItem :label="$t('pages.track.app.apiBodyMask')" prop="apiBodyMaskEnabled">
            <ElSwitch v-model="formData.apiBodyMaskEnabled" :active-value="1" :inactive-value="0" />
            <span class="track-form-hint">{{ $t('pages.track.app.apiBodyMaskHint') }}</span>
          </ElFormItem>
          <ElFormItem :label="$t('pages.track.app.apiBodyRetention')" prop="apiBodyRetentionDays">
            <ElInputNumber
              v-model="formData.apiBodyRetentionDays"
              :min="1"
              :max="30"
              :precision="0"
            />
            <span class="track-form-hint">{{ $t('pages.track.app.retention30Hint') }}</span>
          </ElFormItem>
        </template>
      </template>
      <ElFormItem :label="$t('pages.track.app.geoEnabled')" prop="geoEnabled">
        <ElSwitch v-model="formData.geoEnabled" :active-value="1" :inactive-value="0" />
        <span class="track-form-hint">{{ $t('pages.track.app.geoHint') }}</span>
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.alertEnabled')" prop="alertEnabled">
        <ElSwitch v-model="formData.alertEnabled" :active-value="1" :inactive-value="0" />
        <span class="track-form-hint">{{ $t('pages.track.app.alertHint') }}</span>
      </ElFormItem>
      <ElFormItem
        v-if="formData.alertEnabled === 1"
        :label="$t('pages.track.app.alertThreshold')"
        prop="alertThreshold"
      >
        <ElInputNumber v-model="formData.alertThreshold" :min="1" :max="1000" :precision="0" />
        <span class="track-form-hint">{{ $t('pages.track.app.alertThresholdHint') }}</span>
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.remark')" prop="remark">
        <ElInput
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          :placeholder="$t('pages.track.app.remarkPlaceholder')"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" @click="handleSubmit">{{ $t('table.form.submit') }}</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  interface Props {
    visible: boolean
    type: string
    appData?: Record<string, any>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', form: Record<string, any>): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const { t } = useI18n()

  const formRef = ref<FormInstance>()

  const formData = reactive<Record<string, any>>({
    id: undefined,
    appName: '',
    sampleRate: 100,
    enabled: 1,
    maskSelectors: '',
    retentionDays: 90,
    replayEnabled: 0,
    replaySampleRate: 10,
    replayRetentionDays: 14,
    apiMonitorEnabled: 0,
    apiBodyEnabled: 0,
    apiBodyMaskEnabled: 0,
    apiBodyRetentionDays: 7,
    geoEnabled: 0,
    alertEnabled: 0,
    alertThreshold: 10,
    remark: ''
  })

  const rules: FormRules = {
    appName: [
      { required: true, message: t('pages.track.app.appNamePlaceholder'), trigger: 'blur' }
    ],
    sampleRate: [{ required: true, message: t('pages.track.app.ruleSampleRate'), trigger: 'blur' }],
    retentionDays: [
      { required: true, message: t('pages.track.app.ruleRetentionDays'), trigger: 'blur' }
    ],
    replaySampleRate: [
      { required: true, message: t('pages.track.app.ruleReplaySampleRate'), trigger: 'blur' }
    ],
    replayRetentionDays: [
      { required: true, message: t('pages.track.app.ruleReplayRetention'), trigger: 'blur' }
    ],
    apiBodyRetentionDays: [
      { required: true, message: t('pages.track.app.ruleApiBodyRetention'), trigger: 'blur' }
    ],
    alertThreshold: [
      { required: true, message: t('pages.track.app.ruleAlertThreshold'), trigger: 'blur' }
    ]
  }

  watch(
    () => [props.visible, props.appData],
    ([visible]) => {
      if (visible) {
        Object.assign(
          formData,
          {
            id: undefined,
            appName: '',
            sampleRate: 100,
            enabled: 1,
            maskSelectors: '',
            retentionDays: 90,
            replayEnabled: 0,
            replaySampleRate: 10,
            replayRetentionDays: 14,
            apiMonitorEnabled: 0,
            apiBodyEnabled: 0,
            apiBodyMaskEnabled: 0,
            apiBodyRetentionDays: 7,
            geoEnabled: 0,
            alertEnabled: 0,
            alertThreshold: 10,
            remark: ''
          },
          props.appData || {}
        )
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    await formRef.value.validate((valid) => {
      if (valid) {
        emit('submit', { ...formData })
      }
    })
  }
</script>

<style scoped>
  .track-form-hint {
    margin-left: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>

<!-- 弹窗内容 teleport 到 body，超高表单项（G102 接口监控区块）需非 scoped 类限定滚动，防挤出视口 -->
<style>
  .track-app-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
