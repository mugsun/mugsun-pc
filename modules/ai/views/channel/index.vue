<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('aiChannelList.searchPh')"
          style="width: 200px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <ElButton @click="reload">{{ $t('aiChannelList.search') }}</ElButton>
        <ElButton type="primary" @click="openEdit()">{{ $t('aiChannelList.add') }}</ElButton>
      </div>
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
        :empty-text="emptyText"
        @pagination:size-change="
          (s: number) => {
            pageSize = s
            reload()
          }
        "
        @pagination:current-change="
          (p: number) => {
            pageNum = p
            reload()
          }
        "
      />
    </ElCard>
    <ElDialog
      v-model="visible"
      class="ai-channel-dialog"
      :title="form.id ? $t('aiForm.editChannel') : $t('aiForm.newChannel')"
      width="560px"
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem :label="$t('aiForm.name')" prop="name" :rules="requiredRule($t('aiForm.name'))">
          <ElInput v-model="form.name" maxlength="64" :placeholder="$t('aiForm.phListName')" />
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.channelType')"
          prop="channelType"
          :rules="requiredRule($t('aiForm.channelType'), true)"
        >
          <ElSelect v-model="form.channelType" style="width: 100%">
            <ElOption :label="$t('aiForm.optWecom')" value="wecom" />
            <ElOption :label="$t('aiForm.optDingtalk')" value="dingtalk" />
            <ElOption :label="$t('aiForm.optFeishu')" value="feishu" />
            <ElOption label="Webhook" value="webhook" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Webhook">
          <ElInput v-model="form.webhookUrl" :placeholder="$t('aiForm.phWebhook')" />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.boundApp')">
          <ElInput v-model="form.appId" maxlength="64" :placeholder="$t('aiForm.phBoundApp')" />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.status')">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import type { FormInstance } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { requiredRule } from '../shared/formRules'
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref, nextTick } from 'vue'
  import { ElButton, ElMessageBox } from 'element-plus'
  import {
    fetchAiChannelPage,
    fetchDebugAiChannel,
    fetchRemoveAiChannel,
    fetchSaveAiChannel
  } from '../../api'
  defineOptions({ name: 'AiChannel' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  /** 渠道类型 → 显示用 i18n key；存储/发送的仍是 type 值本身 */
  const TYPE_LABEL_KEYS: Record<string, string> = {
    wecom: 'aiForm.optWecom',
    dingtalk: 'aiForm.optDingtalk',
    feishu: 'aiForm.optFeishu'
  }
  const typeLabel = (v: string) =>
    TYPE_LABEL_KEYS[v] ? t(TYPE_LABEL_KEYS[v]) : v === 'webhook' ? 'Webhook' : v || ''
  const loading = ref(false)
  const searched = ref(false)
  const records = ref<any[]>([])
  const keyword = ref('')
  const pageNum = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  const pager = computed(() => ({
    current: pageNum.value,
    size: pageSize.value,
    total: total.value
  }))
  const emptyText = computed(() =>
    searched.value ? t('aiChannelList.emptySearched') : t('aiChannelList.empty')
  )
  const columns = computed<ColumnOption[]>(() => [
    { type: 'index', width: 60, label: '#' },
    { prop: 'name', label: t('aiChannelList.colName'), minWidth: 140 },
    {
      prop: 'channelType',
      label: t('aiChannelList.colType'),
      width: 120,
      formatter: (row: any) => typeLabel(row.channelType)
    },
    { prop: 'webhookUrl', label: 'Webhook', minWidth: 200, showOverflowTooltip: true },
    {
      prop: 'status',
      label: t('aiChannelList.colStatus'),
      width: 100,
      formatter: (r: any) =>
        r.status === 1 ? t('aiChannelList.enabled') : t('aiChannelList.disabled')
    },
    {
      prop: 'operation',
      label: t('aiChannelList.colOps'),
      width: 200,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', { class: 'ops' }, [
          h(
            ElButton,
            { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
            () => t('aiChannelList.edit')
          ),
          h(ElButton, { link: true, size: 'small', onClick: () => debug(row) }, () =>
            t('aiChannelList.debug')
          ),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => remove(row) },
            () => t('aiChannelList.remove')
          )
        ])
    }
  ])
  async function reload() {
    loading.value = true
    const name = keyword.value.trim()
    searched.value = name.length > 0
    try {
      const res = await fetchAiChannelPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        alias: name || undefined
      })
      records.value = (res?.records ?? []).map((row: any) => ({
        ...row,
        name: row.alias || row.name || '',
        channelType: row.channelCode || row.channelType || '',
        webhookUrl: row.paramsSample || row.webhookUrl || '',
        appId: row.templateCode || row.appId || ''
      }))
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : { channelType: 'webhook', status: 1 })
    visible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      await fetchSaveAiChannel({
        id: form.id,
        channelCode: form.channelType,
        alias: form.name,
        templateCode: form.appId || '',
        paramsSample: form.webhookUrl || '',
        status: form.status
      })
      visible.value = false
      await reload()
    } catch {
      /* 失败提示由请求层展示，弹窗留着方便改完再存 */
    } finally {
      saving.value = false
    }
  }
  async function debug(row: any) {
    try {
      await fetchDebugAiChannel(row.id)
    } catch {
      /* 没发出去时请求层会用服务器说明，不能再显示成成功 */
    }
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      t('aiChannelList.removeConfirm', { name: row.name || t('aiChannelList.thisOne') }),
      t('aiChannelList.confirm')
    )
    await fetchRemoveAiChannel(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
  }
</style>
