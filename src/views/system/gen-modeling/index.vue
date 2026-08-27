<!-- 动态建表 / 规则建模：元数据 → 物理表 DDL，按格式描述 → 人工确认 → 建表 -->
<template>
  <div class="art-full-height">
    <ElCard class="art-table-card">
      <ElTabs v-model="activeTab">
        <ElTabPane :label="$t('pages.system.genModeling.tabModeling')" name="ai">
          <ElInput
            v-model="nl"
            type="textarea"
            :rows="3"
            :placeholder="$t('pages.system.genModeling.nlPlaceholder')"
          />
          <div class="modeling-actions">
            <ElButton type="primary" :loading="drafting" @click="genDraft">{{
              $t('pages.system.genModeling.genDraft')
            }}</ElButton>
            <span class="modeling-tip">{{ $t('pages.system.genModeling.ruleTip') }}</span>
          </div>

          <div v-if="candidate" class="candidate-box">
            <ElForm inline>
              <ElFormItem :label="$t('pages.system.genModeling.tableName')">
                <ElInput v-model="candidate.table.tableName" style="width: 200px" />
              </ElFormItem>
              <ElFormItem :label="$t('pages.system.genModeling.tableComment')">
                <ElInput v-model="candidate.table.tableComment" style="width: 220px" />
              </ElFormItem>
            </ElForm>
            <ElTable :data="candidate.columns" border size="small">
              <ElTableColumn type="index" label="#" width="46" />
              <ElTableColumn :label="$t('pages.system.genModeling.colColumnName')" min-width="150">
                <template #default="{ row }">
                  <ElInput v-model="row.columnName" size="small" />
                </template>
              </ElTableColumn>
              <ElTableColumn :label="$t('pages.system.genModeling.colComment')" min-width="150">
                <template #default="{ row }">
                  <ElInput v-model="row.columnComment" size="small" />
                </template>
              </ElTableColumn>
              <ElTableColumn :label="$t('pages.system.genModeling.colType')" width="160">
                <template #default="{ row }">
                  <ElSelect v-model="row.javaType" size="small">
                    <ElOption v-for="t in javaTypes" :key="t" :label="t" :value="t" />
                  </ElSelect>
                </template>
              </ElTableColumn>
              <ElTableColumn :label="$t('pages.system.genModeling.colOperation')" width="70">
                <template #default="{ $index }">
                  <ElButton
                    link
                    type="danger"
                    size="small"
                    @click="candidate.columns.splice($index, 1)"
                    >{{ $t('pages.system.genModeling.removeShort') }}</ElButton
                  >
                </template>
              </ElTableColumn>
            </ElTable>
            <div class="modeling-actions">
              <ElButton @click="addCol">{{ $t('pages.system.genModeling.addColumn') }}</ElButton>
              <ElButton
                v-perm="'sys:gen:ddl'"
                type="success"
                :loading="confirming"
                @click="confirmBuild(true)"
                >{{ $t('pages.system.genModeling.confirmBuild') }}</ElButton
              >
              <ElButton v-perm="'sys:gen:ddl'" :loading="confirming" @click="confirmBuild(false)">{{
                $t('pages.system.genModeling.saveOnly')
              }}</ElButton>
            </div>
          </div>
        </ElTabPane>

        <ElTabPane :label="$t('pages.system.genModeling.tabManage')" name="manage">
          <ElButton @click="loadTables">{{ $t('pages.system.genModeling.refresh') }}</ElButton>
          <ElTable :data="tables" border v-loading="loading" style="margin-top: 10px">
            <ElTableColumn type="index" label="#" width="50" />
            <ElTableColumn
              prop="tableName"
              :label="$t('pages.system.genModeling.tableName')"
              min-width="170"
            />
            <ElTableColumn
              prop="functionName"
              :label="$t('pages.system.genModeling.colFunction')"
              min-width="140"
            />
            <ElTableColumn
              :label="$t('pages.system.genModeling.colOperation')"
              width="400"
              fixed="right"
            >
              <template #default="{ row }">
                <ElButton link type="primary" size="small" @click="openColumns(row)">{{
                  $t('pages.system.genModeling.columnsConfig')
                }}</ElButton>
                <ElButton
                  v-perm="'sys:gen:preview'"
                  link
                  type="info"
                  size="small"
                  @click="preview(row)"
                  >{{ $t('pages.system.genModeling.previewDdl') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:gen:ddl'"
                  link
                  type="success"
                  size="small"
                  @click="doCreate(row)"
                  >{{ $t('pages.system.genModeling.createTable') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:gen:ddl'"
                  link
                  type="warning"
                  size="small"
                  @click="doSync(row, false)"
                  >{{ $t('pages.system.genModeling.syncIncremental') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:gen:ddl'"
                  link
                  type="danger"
                  size="small"
                  @click="doSync(row, true)"
                  >{{ $t('pages.system.genModeling.syncForce') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>

      <ElDialog
        v-if="ddlVisible"
        v-model="ddlVisible"
        :title="$t('pages.system.genModeling.ddlPreviewTitle')"
        width="660px"
        align-center
        destroy-on-close
        @closed="ddlVisible = false"
      >
        <pre class="ddl-pre">{{ ddlText }}</pre>
      </ElDialog>

      <ElDialog
        v-if="colVisible"
        v-model="colVisible"
        :title="
          $t('pages.system.genModeling.columnsConfigTitle', {
            name: editing?.table?.tableName || ''
          })
        "
        width="760px"
        align-center
        destroy-on-close
        @closed="colVisible = false"
      >
        <div class="modeling-tip">{{ $t('pages.system.genModeling.columnsTip') }}</div>
        <ElTable
          :data="editing?.columns || []"
          border
          size="small"
          max-height="420"
          style="margin-top: 10px"
        >
          <ElTableColumn type="index" label="#" width="46" />
          <ElTableColumn :label="$t('pages.system.genModeling.colColumnName')" min-width="160">
            <template #default="{ row }">
              <ElInput v-model="row.columnName" size="small" />
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.genModeling.colComment')" min-width="150">
            <template #default="{ row }">
              <ElInput v-model="row.columnComment" size="small" />
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.genModeling.colType')" width="150">
            <template #default="{ row }">
              <ElSelect v-model="row.javaType" size="small">
                <ElOption v-for="t in javaTypes" :key="t" :label="t" :value="t" />
              </ElSelect>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.genModeling.colOperation')" width="70">
            <template #default="{ $index }">
              <ElButton
                link
                type="danger"
                size="small"
                @click="editing.columns.splice($index, 1)"
                >{{ $t('pages.system.genModeling.removeShort') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
        <template #footer>
          <ElButton @click="addEditCol">{{ $t('pages.system.genModeling.addColumn') }}</ElButton>
          <ElButton
            v-perm="'sys:gen:edit'"
            type="primary"
            :loading="colSaving"
            @click="saveColumns(false)"
            >{{ $t('pages.system.genModeling.saveConfig') }}</ElButton
          >
          <ElButton
            v-perm="'sys:gen:ddl'"
            type="warning"
            :loading="colSaving"
            @click="saveColumns(true)"
            >{{ $t('pages.system.genModeling.saveAndSync') }}</ElButton
          >
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onDeactivated } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchGenList,
    fetchGenMeta,
    fetchSaveGenMeta,
    fetchDdlPreview,
    fetchDdlCreate,
    fetchDdlSync,
    fetchAiDraft,
    fetchAiConfirm
  } from '@/api/system-manage'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'GenModeling' })

  const { t } = useI18n()

  const javaTypes = [
    'String',
    'Integer',
    'Long',
    'BigDecimal',
    'Double',
    'LocalDateTime',
    'LocalDate'
  ]
  const activeTab = ref('ai')
  const nl = ref('')
  const drafting = ref(false)
  const confirming = ref(false)
  const candidate = ref<any>(null)
  const tables = ref<any[]>([])
  const loading = ref(false)
  const ddlVisible = ref(false)
  const ddlText = ref('')
  const colVisible = ref(false)
  const colSaving = ref(false)
  const editing = ref<any>(null)

  const genDraft = async (): Promise<void> => {
    drafting.value = true
    try {
      candidate.value = await fetchAiDraft(nl.value)
    } finally {
      drafting.value = false
    }
  }

  const addCol = (): void => {
    candidate.value.columns.push({
      columnName: '',
      columnComment: '',
      javaType: 'String',
      htmlType: 'input',
      isPk: 0,
      isInsert: 1,
      isEdit: 1,
      isList: 1,
      isQuery: 0,
      queryType: 'LIKE'
    })
  }

  const confirmBuild = async (build: boolean): Promise<void> => {
    confirming.value = true
    try {
      await fetchAiConfirm({
        table: candidate.value.table,
        columns: candidate.value.columns,
        build
      })
      ElMessage.success(
        build
          ? t('pages.system.genModeling.confirmBuilt')
          : t('pages.system.genModeling.saveOnlySuccess')
      )
      candidate.value = null
      nl.value = ''
      activeTab.value = 'manage'
      loadTables()
    } finally {
      confirming.value = false
    }
  }

  const loadTables = async (): Promise<void> => {
    loading.value = true
    try {
      tables.value = (await fetchGenList()) || []
    } finally {
      loading.value = false
    }
  }

  const closeDialogs = (): void => {
    ddlVisible.value = false
    colVisible.value = false
    ElMessageBox.close()
  }

  const preview = async (row: any): Promise<void> => {
    colVisible.value = false
    const stmts = (await fetchDdlPreview(row.id, false)) || []
    ddlText.value = stmts.length
      ? stmts.join(';\n\n') + ';'
      : t('pages.system.genModeling.noChanges')
    ddlVisible.value = true
  }

  const doCreate = async (row: any): Promise<void> => {
    await ElMessageBox.confirm(
      t('pages.system.genModeling.createConfirm', { name: row.tableName }),
      t('pages.system.genModeling.createTable'),
      { type: 'warning' }
    )
    await fetchDdlCreate(row.id)
    ElMessage.success(t('pages.system.genModeling.createSuccess'))
  }

  const doSync = async (row: any, force: boolean): Promise<void> => {
    await ElMessageBox.confirm(
      force
        ? t('pages.system.genModeling.forceConfirm', { name: row.tableName })
        : t('pages.system.genModeling.incrementalConfirm', { name: row.tableName }),
      force
        ? t('pages.system.genModeling.syncForce')
        : t('pages.system.genModeling.syncIncremental'),
      { type: force ? 'error' : 'warning' }
    )
    await fetchDdlSync(row.id, force, true)
  }

  // 打开字段配置：拉元数据并快照原列名，用于改名追踪
  const openColumns = async (row: any): Promise<void> => {
    ddlVisible.value = false
    const meta: any = await fetchGenMeta(row.id)
    ;(meta.columns || []).forEach((c: any) => (c._origName = c.columnName))
    editing.value = meta
    colVisible.value = true
  }

  const addEditCol = (): void => {
    editing.value.columns.push({
      columnName: '',
      columnComment: '',
      javaType: 'String',
      htmlType: 'input',
      isPk: 0,
      isInsert: 1,
      isEdit: 1,
      isList: 1,
      isQuery: 0,
      queryType: 'LIKE'
    })
  }

  const saveColumns = async (sync: boolean): Promise<void> => {
    colSaving.value = true
    try {
      const table = editing.value.table
      const columns = editing.value.columns.map((c: any) => {
        const { _origName, ...rest } = c
        // 已有列改了名 → 记录旧名，同步时走 RENAME
        if (rest.id && _origName && _origName !== rest.columnName) {
          rest.columnNameOld = _origName
        }
        return rest
      })
      await fetchSaveGenMeta({ table, columns })
      if (sync) {
        await fetchDdlSync(table.id, false)
        ElMessage.success(t('pages.system.genModeling.saveAndSyncSuccess'))
      } else {
        ElMessage.success(t('pages.system.genModeling.configSaved'))
      }
      colVisible.value = false
    } finally {
      colSaving.value = false
    }
  }

  onMounted(loadTables)
  onDeactivated(closeDialogs)
</script>

<style scoped>
  .modeling-actions {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 12px;
  }

  .modeling-tip {
    font-size: 12px;
    color: var(--art-text-gray-500);
  }

  .candidate-box {
    margin-top: 16px;
  }

  .ddl-pre {
    max-height: 420px;
    padding: 12px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
    word-break: break-all;
    white-space: pre-wrap;
    background: var(--art-gray-100);
    border-radius: 6px;
  }

  /* 页签内容自由增长（候选表/管理表行数不定）：卡片体与 tabs 改 flex 列布局，
     el-tabs__content 内部滚动，防矮视口下被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .art-table-card :deep(.el-tabs) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .art-table-card :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
