<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索渠道名称"
          style="width: 200px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">新增渠道绑定</ElButton>
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
      :title="form.id ? '编辑渠道' : '新增渠道'"
      width="560px"
    >
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="名称" required>
          <ElInput v-model="form.name" maxlength="64" placeholder="用来在列表里区分" />
        </ElFormItem>
        <ElFormItem label="渠道类型" required>
          <ElSelect v-model="form.channelType" style="width: 100%">
            <ElOption label="企微" value="wecom" />
            <ElOption label="钉钉" value="dingtalk" />
            <ElOption label="飞书" value="feishu" />
            <ElOption label="Webhook" value="webhook" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Webhook">
          <ElInput v-model="form.webhookUrl" placeholder="留空可以先保存，调试前再填地址" />
        </ElFormItem>
        <ElFormItem label="绑定应用">
          <ElInput v-model="form.appId" maxlength="64" placeholder="选填，用来标明发给哪个应用" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref } from 'vue'
  import { ElButton, ElMessageBox } from 'element-plus'
  import {
    fetchAiChannelPage,
    fetchDebugAiChannel,
    fetchRemoveAiChannel,
    fetchSaveAiChannel
  } from '../../api'
  defineOptions({ name: 'AiChannel' })
  const TYPE_LABEL: Record<string, string> = {
    wecom: '企微',
    dingtalk: '钉钉',
    feishu: '飞书',
    webhook: 'Webhook'
  }
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
    searched.value ? '没有符合条件的渠道。换个名称再查' : '还没有渠道。点新增渠道绑定开始配置'
  )
  const columns: ColumnOption[] = [
    { type: 'index', width: 60, label: '#' },
    { prop: 'name', label: '名称', minWidth: 140 },
    {
      prop: 'channelType',
      label: '类型',
      width: 120,
      formatter: (row: any) => TYPE_LABEL[row.channelType] || row.channelType || ''
    },
    { prop: 'webhookUrl', label: 'Webhook', minWidth: 200, showOverflowTooltip: true },
    {
      prop: 'status',
      label: '状态',
      width: 80,
      formatter: (r: any) => (r.status === 1 ? '启用' : '停用')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 200,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', { class: 'ops' }, [
          h(
            ElButton,
            { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
            () => '编辑'
          ),
          h(ElButton, { link: true, size: 'small', onClick: () => debug(row) }, () => '调试'),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => remove(row) },
            () => '删除'
          )
        ])
    }
  ]
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
  }
  async function save() {
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
      `删除「${row.name || '这个渠道'}」后，列表里不会再出现，消息也不会再发到这里`,
      '确认'
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
