<!-- API 密钥管理页（对接 /system/api-key） -->
<template>
  <div class="apikey-page art-full-height">
    <ElCard class="art-table-card">
      <div class="apikey-toolbar">
        <ElInput
          v-model="keyword"
          clearable
          class="apikey-search"
          :placeholder="$t('pages.system.apiKey.searchPlaceholder')"
          @keyup.enter="search"
        />
        <ElButton type="primary" @click="search">{{ $t('pages.system.apiKey.search') }}</ElButton>
        <ElButton @click="resetSearch">{{ $t('pages.system.apiKey.reset') }}</ElButton>
        <ElButton v-perm="'sys:api-key:generate'" type="primary" @click="showDialog">{{
          $t('pages.system.apiKey.generateBtn')
        }}</ElButton>
        <ElButton v-perm="'sys:api-key:remove'" type="danger" plain @click="removeSelected">{{
          $t('pages.system.apiKey.deleteSelected')
        }}</ElButton>
      </div>

      <div class="apikey-table-scroll">
        <ElTable
          :data="tableData"
          border
          v-loading="loading"
          :empty-text="emptyText"
          @selection-change="onSelectionChange"
        >
          <ElTableColumn type="selection" width="48" />
          <ElTableColumn type="index" :label="$t('pages.system.apiKey.colIndex')" width="55" />
          <ElTableColumn
            prop="name"
            :label="$t('pages.system.apiKey.colName')"
            min-width="110"
            show-overflow-tooltip
          />
          <ElTableColumn prop="accessKey" label="AccessKey" min-width="140" show-overflow-tooltip />
          <ElTableColumn prop="secretKey" label="SecretKey" min-width="110" show-overflow-tooltip />
          <ElTableColumn
            prop="scope"
            :label="$t('pages.system.apiKey.colScope')"
            min-width="100"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="apiPath"
            :label="$t('pages.system.apiKey.colPath')"
            min-width="120"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="expireTime"
            :label="$t('pages.system.apiKey.colExpire')"
            min-width="160"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.apiKey.colStatus')" width="72">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1
                    ? $t('pages.system.apiKey.statusEnabled')
                    : $t('pages.system.apiKey.statusDisabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <!-- 双操作按钮：收窄列宽使常见视口下状态+操作同屏，避免半截「删除」 -->
          <ElTableColumn :label="$t('pages.system.apiKey.colOperation')" width="196" fixed="right">
            <template #default="{ row }">
              <!-- 语义配色：启用用主题色，停用才用 warning -->
              <ElButton
                v-perm="'sys:api-key:edit'"
                link
                :type="row.status === 1 ? 'warning' : 'primary'"
                @click="toggle(row)"
              >
                {{
                  row.status === 1
                    ? $t('pages.system.apiKey.statusDisabled')
                    : $t('pages.system.apiKey.statusEnabled')
                }}
              </ElButton>
              <ElButton v-perm="'sys:api-key:remove'" link type="danger" @click="remove(row)">{{
                $t('pages.system.apiKey.deleteBtn')
              }}</ElButton>
              <ElButton v-perm="'sys:api-key:log'" link type="primary" @click="openLogs(row)">{{
                $t('pages.system.apiKey.callLog')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <!-- 生成 -->
    <ElDialog
      v-model="dialogVisible"
      :title="$t('pages.system.apiKey.generateBtn')"
      width="500px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="80px">
        <ElFormItem :label="$t('pages.system.apiKey.colName')" prop="name">
          <ElInput v-model="form.name" :placeholder="$t('pages.system.apiKey.namePlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiKey.colScope')" prop="scope">
          <ElInput
            v-model="form.scope"
            maxlength="255"
            :placeholder="$t('pages.system.apiKey.scopePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiKey.colPath')" prop="apiPath">
          <ElInput
            v-model="form.apiPath"
            maxlength="255"
            :placeholder="$t('pages.system.apiKey.pathPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiKey.colExpire')">
          <ElDatePicker
            v-model="form.expireTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            :placeholder="$t('pages.system.apiKey.expirePlaceholder')"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiKey.remarkLabel')" prop="remark">
          <ElInput
            v-model="form.remark"
            type="textarea"
            maxlength="255"
            show-word-limit
            :placeholder="$t('pages.system.apiKey.remarkLabel')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">{{
          $t('pages.system.apiKey.generateSubmitBtn')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 生成结果（SK 仅此一次） -->
    <ElDialog
      v-model="resultVisible"
      :title="$t('pages.system.apiKey.resultTitle')"
      width="560px"
      align-center
      destroy-on-close
    >
      <ElAlert type="warning" :closable="false" :title="$t('pages.system.apiKey.resultWarning')" />
      <ElDescriptions :column="1" border class="apikey-result">
        <ElDescriptionsItem label="AccessKey">{{ generated.accessKey }}</ElDescriptionsItem>
        <ElDescriptionsItem label="SecretKey">{{ generated.secretKey }}</ElDescriptionsItem>
      </ElDescriptions>
      <template #footer>
        <ElButton type="primary" @click="resultVisible = false">{{
          $t('pages.system.apiKey.savedBtn')
        }}</ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="logVisible" :title="logTitle" size="640px" append-to-body destroy-on-close>
      <div class="apikey-log-bar">
        <ElSelect
          v-model="logStatus"
          :placeholder="$t('pages.system.apiKey.resultAll')"
          clearable
          style="width: 140px"
          @change="loadLogs"
        >
          <ElOption :label="$t('pages.system.apiKey.pass')" :value="1" />
          <ElOption :label="$t('pages.system.apiKey.deny')" :value="0" />
        </ElSelect>
        <ElInput
          v-model="logIp"
          :placeholder="$t('pages.system.apiKey.ipPlaceholder')"
          clearable
          style="width: 180px"
          @keyup.enter="loadLogs"
        />
        <ElButton type="primary" @click="loadLogs">{{ $t('pages.system.apiKey.search') }}</ElButton>
        <ElButton @click="resetLogs">{{ $t('pages.system.apiKey.reset') }}</ElButton>
      </div>
      <ElTable
        :data="logRows"
        border
        v-loading="logLoading"
        :empty-text="$t('pages.system.apiKey.empty')"
      >
        <ElTableColumn prop="method" :label="$t('pages.system.apiKey.method')" width="72" />
        <ElTableColumn
          prop="requestUri"
          :label="$t('pages.system.apiKey.path')"
          min-width="140"
          show-overflow-tooltip
        />
        <ElTableColumn :label="$t('pages.system.apiKey.result')" width="72">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'danger'">
              {{
                row.status === 1 ? $t('pages.system.apiKey.pass') : $t('pages.system.apiKey.deny')
              }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="remoteIp" label="IP" width="120" show-overflow-tooltip />
        <ElTableColumn :label="$t('pages.system.apiKey.cost')" width="80">
          <template #default="{ row }">{{ row.costMs ?? 0 }} ms</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.apiKey.colOperation')" width="64" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openLogDetail(row)">{{
              $t('pages.system.apiKey.detail')
            }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElDrawer>

    <ElDialog
      v-model="logDetailVisible"
      :title="$t('pages.system.apiKey.detailTitle')"
      width="520px"
      align-center
      append-to-body
    >
      <ElDescriptions v-if="logDetail" :column="1" border>
        <ElDescriptionsItem :label="$t('pages.system.apiKey.method')">{{
          logDetail.method || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.apiKey.path')">{{
          logDetail.requestUri || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.apiKey.result')">
          {{
            logDetail.status === 1 ? $t('pages.system.apiKey.pass') : $t('pages.system.apiKey.deny')
          }}
        </ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.apiKey.message')">{{
          logDetail.msg || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem label="IP">{{ logDetail.remoteIp || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.apiKey.cost')"
          >{{ logDetail.costMs ?? 0 }} ms</ElDescriptionsItem
        >
        <ElDescriptionsItem :label="$t('pages.system.apiKey.time')">{{
          formatTableTime(logDetail.createTime)
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.apiKey.userAgent')">{{
          logDetail.userAgent || $t('pages.system.apiKey.userAgentEmpty')
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.apiKey.params')">{{
          logDetail.params || '—'
        }}</ElDescriptionsItem>
      </ElDescriptions>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onDeactivated, onBeforeUnmount, onMounted } from 'vue'
  import { onBeforeRouteLeave } from 'vue-router'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    fetchApiKeyPage,
    fetchGenerateApiKey,
    fetchEnableApiKey,
    fetchDisableApiKey,
    fetchRemoveApiKey,
    fetchRemoveApiKeys,
    fetchApiKeyLogPage,
    fetchApiKeyLogDetail
  } from '@/api/system-manage'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { formatTableTime } from '@/utils/date'

  defineOptions({ name: 'ApiKey' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const keyword = ref('')
  const filtering = ref(false)
  const selectedRows = ref<any[]>([])
  const emptyText = computed(() =>
    filtering.value ? t('pages.system.apiKey.emptySearch') : t('pages.system.apiKey.emptyList')
  )
  const submitting = ref(false)
  const dialogVisible = ref(false)
  const resultVisible = ref(false)
  const generated = ref<Record<string, any>>({})
  const formRef = ref<FormInstance>()

  const form = reactive<Record<string, any>>({
    name: '',
    scope: '',
    apiPath: '',
    expireTime: '',
    remark: ''
  })
  const logVisible = ref(false)
  const logLoading = ref(false)
  const logTitle = ref('')
  const logKeyId = ref('')
  const logStatus = ref<number | undefined>()
  const logIp = ref('')
  const logRows = ref<any[]>([])
  const logDetailVisible = ref(false)
  const logDetail = ref<Record<string, any> | null>(null)

  const rules: FormRules = {
    name: [
      { required: true, message: t('pages.system.apiKey.namePlaceholder'), trigger: 'blur' },
      { max: 64, message: t('pages.system.apiKey.nameLen'), trigger: 'blur' }
    ]
  }

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const resp = await fetchApiKeyPage({
        pageNum: 1,
        pageSize: 50,
        name: filtering.value ? keyword.value.trim() : undefined
      })
      tableData.value = resp?.records ?? []
    } finally {
      loading.value = false
    }
  }

  const search = (): void => {
    filtering.value = !!keyword.value.trim()
    loadData()
  }

  const resetSearch = (): void => {
    keyword.value = ''
    filtering.value = false
    loadData()
  }

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows || []
  }

  onMounted(loadData)

  const showDialog = (): void => {
    Object.assign(form, { name: '', scope: '', apiPath: '', expireTime: '', remark: '' })
    dialogVisible.value = true
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value || submitting.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      submitting.value = true
      try {
        generated.value = (await fetchGenerateApiKey({ ...form })) || {}
        dialogVisible.value = false
        resultVisible.value = true
        loadData()
      } finally {
        submitting.value = false
      }
    })
  }

  const toggle = async (row: any): Promise<void> => {
    // 启用无风险直接执行；停用会立即吊销该密钥的 API 访问，属危险操作须二次确认
    if (row.status !== 1) {
      await fetchEnableApiKey(row.id)
      loadData()
      return
    }
    ElMessageBox.confirm(
      t('pages.system.apiKey.disableConfirm', { name: row.name }),
      t('pages.system.apiKey.disableTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchDisableApiKey(row.id)
        loadData()
      })
      .catch(() => {
        /* cancel */
      })
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.apiKey.deleteConfirm', { name: row.name }),
      t('pages.system.apiKey.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveApiKey(row.id)
        selectedRows.value = []
        loadData()
      })
      .catch(() => {
        /* cancel */
      })
  }

  const removeSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.apiKey.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.apiKey.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.apiKey.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveApiKeys(selectedRows.value.map((row) => row.id))
        selectedRows.value = []
        loadData()
      })
      .catch(() => {
        /* cancel */
      })
  }

  const openLogs = (row: any): void => {
    logKeyId.value = String(row.id)
    logTitle.value = t('pages.system.apiKey.callLogTitle', { name: row.name || row.accessKey })
    logStatus.value = undefined
    logIp.value = ''
    logRows.value = []
    logVisible.value = true
    loadLogs()
  }

  const loadLogs = async (): Promise<void> => {
    if (!logKeyId.value) return
    logLoading.value = true
    try {
      const resp = await fetchApiKeyLogPage({
        apiKeyId: logKeyId.value,
        pageNum: 1,
        pageSize: 20,
        status: logStatus.value,
        ip: logIp.value || undefined
      })
      logRows.value = resp?.records ?? []
    } finally {
      logLoading.value = false
    }
  }

  const resetLogs = (): void => {
    logStatus.value = undefined
    logIp.value = ''
    loadLogs()
  }

  const openLogDetail = async (row: any): Promise<void> => {
    logDetail.value = await fetchApiKeyLogDetail(row.id)
    logDetailVisible.value = true
  }

  const closeOverlays = (): void => {
    dialogVisible.value = false
    resultVisible.value = false
    logVisible.value = false
    logDetailVisible.value = false
    ElMessageBox.close()
  }

  onDeactivated(closeOverlays)

  onBeforeRouteLeave(() => {
    closeOverlays()
  })

  onBeforeUnmount(closeOverlays)
</script>

<style scoped>
  /* 表格为自由增长内容：.art-table-card 定高 + .el-card__body 裁剪，
     须自备内部滚动，否则矮视口多行时底部行被切断不可达（范式同 monitor/track-user） */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .apikey-toolbar {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .apikey-search {
    width: 220px;
  }

  .apikey-table-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .apikey-result {
    margin-top: 14px;
  }

  .apikey-log-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
</style>
