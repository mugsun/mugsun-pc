<!-- 在线代码生成（元数据驱动·对齐平台规约全栈产物） -->
<template>
  <div class="gen-page art-full-height">
    <ElCard class="art-table-card">
      <ElDescriptions
        :title="$t('pages.system.gen.datasource')"
        :column="4"
        border
        size="small"
        class="gen-ds"
      >
        <!-- 后端读不到连接配置时字段为 null，统一 '-' 兜底，避免出现无标题空白格 -->
        <ElDescriptionsItem :label="$t('pages.system.gen.dsName')">{{
          datasource.name || '-'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.gen.dsDriver')">{{
          datasource.driver || '-'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.gen.dsUsername')">{{
          datasource.username || '-'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.gen.dsUrl')" :span="1">{{
          datasource.url || '-'
        }}</ElDescriptionsItem>
      </ElDescriptions>

      <div class="gen-form">
        <span class="gen-label">{{ $t('pages.system.gen.table') }}</span>
        <ElSelect
          v-model="importForm.tableName"
          filterable
          :placeholder="$t('pages.system.gen.tablePlaceholder')"
          style="width: 220px"
        >
          <ElOption v-for="t in tables" :key="t.name" :label="tableLabel(t)" :value="t.name" />
        </ElSelect>
        <span class="gen-label">{{ $t('pages.system.gen.module') }}</span>
        <ElInput
          v-model="importForm.moduleName"
          style="width: 110px"
          :placeholder="$t('pages.system.gen.modulePlaceholder')"
        />
        <span class="gen-label">{{ $t('pages.system.gen.basePackage') }}</span>
        <ElInput
          v-model="importForm.basePackage"
          style="width: 180px"
          placeholder="com.mugsun.boot"
        />
        <span class="gen-label">{{ $t('pages.system.gen.prefix') }}</span>
        <ElInput
          v-model="importForm.tablePrefix"
          style="width: 90px"
          :placeholder="$t('pages.system.gen.prefixPlaceholder')"
        />
        <span class="gen-label">{{ $t('pages.system.gen.author') }}</span>
        <ElInput v-model="importForm.author" style="width: 100px" placeholder="mugsun" />
        <ElButton
          v-perm="'sys:gen:import'"
          type="primary"
          :loading="importing"
          :disabled="!importForm.tableName"
          @click="onImport"
        >
          {{ $t('pages.system.gen.importBtn') }}
        </ElButton>
      </div>

      <!-- 列表自由增长：包一层 flex:1 定高壳，表格 height="100%" 内部滚动，防矮视口裁切 -->
      <div class="gen-list-wrap">
        <ElTable v-loading="listLoading" :data="genList" border size="small" height="100%">
          <ElTableColumn type="index" label="#" width="50" />
          <ElTableColumn
            prop="tableName"
            :label="$t('pages.system.gen.colTableName')"
            min-width="150"
          />
          <ElTableColumn
            prop="entityName"
            :label="$t('pages.system.gen.colEntity')"
            min-width="120"
          />
          <ElTableColumn prop="moduleName" :label="$t('pages.system.gen.module')" min-width="90" />
          <ElTableColumn
            prop="functionName"
            :label="$t('pages.system.gen.colFunction')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.gen.colOperation')" width="280" fixed="right">
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:gen:edit'"
                link
                type="primary"
                size="small"
                @click="openConfig(row)"
                >{{ $t('pages.system.gen.config') }}</ElButton
              >
              <ElButton
                v-perm="'sys:gen:preview'"
                link
                type="primary"
                size="small"
                @click="openPreview(row)"
                >{{ $t('pages.system.gen.preview') }}</ElButton
              >
              <ElButton
                v-perm="'sys:gen:edit'"
                link
                type="warning"
                size="small"
                @click="doSync(row)"
                >{{ $t('pages.system.gen.sync') }}</ElButton
              >
              <ElButton
                v-perm="'sys:gen:preview'"
                link
                type="success"
                size="small"
                @click="doDownload(row)"
                >{{ $t('pages.system.gen.download') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <!-- 字段级配置 -->
    <ElDialog
      v-if="configVisible"
      v-model="configVisible"
      :title="$t('pages.system.gen.configTitle')"
      width="920px"
      align-center
      destroy-on-close
      @closed="configVisible = false"
    >
      <div v-if="configTable" class="gen-form" style="margin-bottom: 12px">
        <span class="gen-label">{{ $t('pages.system.gen.tpl') }}</span>
        <ElSelect v-model="configTable.tplCategory" style="width: 120px">
          <ElOption :label="$t('pages.system.gen.tplCrud')" value="crud" />
          <ElOption :label="$t('pages.system.gen.tplTree')" value="tree" />
          <ElOption :label="$t('pages.system.gen.tplMaster')" value="master" />
        </ElSelect>
        <template v-if="configTable.tplCategory === 'tree'">
          <span class="gen-label">{{ $t('pages.system.gen.treeParentField') }}</span>
          <ElInput
            v-model="configTable.treeParentField"
            style="width: 130px"
            placeholder="parent_id"
          />
        </template>
        <template v-if="configTable.tplCategory === 'master'">
          <span class="gen-label">{{ $t('pages.system.gen.subTable') }}</span>
          <ElInput
            v-model="configTable.subTableName"
            style="width: 170px"
            :placeholder="$t('pages.system.gen.subTablePlaceholder')"
          />
          <span class="gen-label">{{ $t('pages.system.gen.subJoinField') }}</span>
          <ElInput
            v-model="configTable.subJoinField"
            style="width: 130px"
            :placeholder="$t('pages.system.gen.subJoinPlaceholder')"
          />
        </template>
      </div>
      <ElTable :data="configColumns" border size="small" max-height="420">
        <ElTableColumn prop="javaField" :label="$t('pages.system.gen.colField')" min-width="120" />
        <ElTableColumn prop="javaType" :label="$t('pages.system.gen.colType')" min-width="90" />
        <ElTableColumn :label="$t('pages.system.gen.colComment')" min-width="130">
          <template #default="{ row }">
            <ElInput v-model="row.columnComment" size="small" />
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.gen.colControl')" width="130">
          <template #default="{ row }">
            <ElSelect v-model="row.htmlType" size="small">
              <ElOption v-for="h in htmlTypes" :key="h" :label="h" :value="h" />
            </ElSelect>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.gen.colDict')" width="120">
          <template #default="{ row }">
            <ElInput
              v-model="row.dictType"
              size="small"
              :placeholder="$t('pages.system.gen.dictPlaceholder')"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.gen.colList')" width="60" align="center">
          <template #default="{ row }">
            <ElSwitch v-model="row.isList" :active-value="1" :inactive-value="0" />
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.gen.colForm')" width="60" align="center">
          <template #default="{ row }">
            <ElSwitch v-model="row.isEdit" :active-value="1" :inactive-value="0" />
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.gen.colQuery')" width="60" align="center">
          <template #default="{ row }">
            <ElSwitch v-model="row.isQuery" :active-value="1" :inactive-value="0" />
          </template>
        </ElTableColumn>
      </ElTable>
      <template #footer>
        <ElButton @click="configVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="configSaving" @click="saveConfig">{{
          $t('pages.system.gen.saveConfig')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 代码预览 -->
    <ElDialog
      v-if="previewVisible"
      v-model="previewVisible"
      :title="$t('pages.system.gen.previewTitle')"
      width="1000px"
      align-center
      destroy-on-close
      @closed="previewVisible = false"
    >
      <ElTabs v-model="activeTab">
        <ElTabPane v-for="tab in codeTabs" :key="tab.key" :label="tab.label" :name="tab.key">
          <pre class="gen-code">{{ code[tab.key] }}</pre>
        </ElTabPane>
      </ElTabs>
      <template #footer>
        <ElButton @click="previewVisible = false">{{ $t('pages.system.gen.close') }}</ElButton>
        <ElButton type="success" @click="doDownload(previewRow)">{{
          $t('pages.system.gen.downloadZip')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onDeactivated } from 'vue'
  import {
    fetchGenDatasource,
    fetchGenTables,
    fetchGenImport,
    fetchGenList,
    fetchGenMeta,
    fetchSaveGenMeta,
    fetchGenSync,
    fetchGenPreviewMeta,
    downloadGenZip
  } from '@/api/system-manage'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Gen' })

  const { t } = useI18n()

  const datasource = ref<Record<string, any>>({})
  const tables = ref<any[]>([])
  const genList = ref<any[]>([])
  const importing = ref(false)
  const listLoading = ref(false)
  const configSaving = ref(false)

  const importForm = reactive({
    tableName: '',
    moduleName: 'system',
    basePackage: 'com.mugsun.boot',
    tablePrefix: '',
    author: 'mugsun'
  })

  const htmlTypes = [
    'input',
    'textarea',
    'select',
    'radio',
    'checkbox',
    'number',
    'datetime',
    'switch'
  ]
  const codeTabs = computed(() => [
    { key: 'entity', label: 'Entity' },
    { key: 'mapper', label: 'Mapper' },
    { key: 'controller', label: 'Controller' },
    { key: 'vue', label: t('pages.system.gen.tabVue') },
    { key: 'api', label: 'api.ts' },
    { key: 'type', label: 'type.ts' },
    { key: 'menu', label: t('pages.system.gen.tabMenu') }
  ])

  // 字段配置
  const configVisible = ref(false)
  const configTable = ref<any>(null)
  const configColumns = ref<any[]>([])
  // 预览
  const previewVisible = ref(false)
  const previewRow = ref<any>(null)
  const code = ref<Record<string, string>>({})
  const activeTab = ref('entity')

  const tableLabel = (tb: any): string =>
    tb.comment
      ? t('pages.system.gen.tableLabelFmt', { name: tb.name, comment: tb.comment })
      : tb.name

  const loadList = async (): Promise<void> => {
    listLoading.value = true
    try {
      genList.value = (await fetchGenList()) || []
    } finally {
      listLoading.value = false
    }
  }

  const onImport = async (): Promise<void> => {
    importing.value = true
    try {
      await fetchGenImport({ ...importForm })
      ElMessage.success(t('pages.system.gen.importSuccess'))
      await loadList()
    } finally {
      importing.value = false
    }
  }

  const closeDialogs = () => {
    configVisible.value = false
    previewVisible.value = false
    ElMessageBox.close()
  }

  const openConfig = async (row: any): Promise<void> => {
    previewVisible.value = false
    const meta = await fetchGenMeta(row.id)
    configTable.value = meta?.table ?? null
    configColumns.value = meta?.columns ?? []
    configVisible.value = true
  }

  const saveConfig = async (): Promise<void> => {
    configSaving.value = true
    try {
      await fetchSaveGenMeta({ table: configTable.value, columns: configColumns.value })
      ElMessage.success(t('pages.system.gen.configSaved'))
      configVisible.value = false
    } finally {
      configSaving.value = false
    }
  }

  const doSync = async (row: any): Promise<void> => {
    await fetchGenSync(row.id)
    ElMessage.success(t('pages.system.gen.syncSuccess'))
  }

  const openPreview = async (row: any): Promise<void> => {
    configVisible.value = false
    previewRow.value = row
    code.value = (await fetchGenPreviewMeta(row.id)) || {}
    activeTab.value = 'entity'
    previewVisible.value = true
  }

  const doDownload = async (row: any): Promise<void> => {
    if (row) await downloadGenZip(row.id)
  }

  onMounted(async () => {
    datasource.value = (await fetchGenDatasource()) || {}
    tables.value = (await fetchGenTables()) || []
    await loadList()
  })

  onDeactivated(closeDialogs)
</script>

<style scoped>
  .gen-ds {
    margin-bottom: 16px;
  }

  .gen-form {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 16px;
  }

  .gen-label {
    font-size: 13px;
    color: var(--art-text-gray-600);
  }

  /* 列表自由增长：卡片体改 flex 列布局 + 列表壳 flex:1 定高，
     表格 height="100%" 内部滚动，防矮视口下行被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .gen-list-wrap {
    flex: 1;
    min-height: 0;
  }

  .gen-code {
    max-height: 480px;
    padding: 12px;
    margin: 0;
    overflow: auto;
    font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre;
    background: var(--art-main-bg-color);
    border-radius: 6px;
  }
</style>
