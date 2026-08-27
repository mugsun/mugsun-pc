<!-- 缓存管理：按前缀分组查看 Redis 键、查看值/TTL、清除 -->
<template>
  <div class="cache-page art-full-height">
    <ElRow :gutter="12">
      <!-- 左：缓存分组 -->
      <ElCol :xs="24" :lg="8">
        <ElCard class="art-table-card" shadow="never">
          <div class="panel-toolbar">
            <span class="panel-title">{{ $t('pages.system.cache.groupTitle') }}</span>
            <ElButton size="small" @click="loadGroups">{{
              $t('pages.system.cache.refreshBtn')
            }}</ElButton>
          </div>
          <ElTable
            ref="groupTableRef"
            v-loading="groupLoading"
            :data="groups"
            border
            row-key="name"
            highlight-current-row
            @row-click="onGroupSelect"
          >
            <ElTableColumn prop="name" :label="$t('pages.system.cache.colName')" min-width="160" />
            <ElTableColumn prop="count" :label="$t('pages.system.cache.colCount')" width="90">
              <template #default="{ row }">{{ Number(row.count ?? 0).toLocaleString() }}</template>
            </ElTableColumn>
          </ElTable>
        </ElCard>
      </ElCol>

      <!-- 右：键列表 -->
      <ElCol :xs="24" :lg="16">
        <ElCard class="art-table-card" shadow="never">
          <div class="panel-toolbar">
            <span class="panel-title">
              {{
                selectedGroup
                  ? $t('pages.system.cache.keyListTitle', {
                      name: selectedGroup.name,
                      count: keys.length
                    })
                  : $t('pages.system.cache.keyListEmpty')
              }}
            </span>
            <ElButton
              v-perm="'sys:cache:manage'"
              size="small"
              type="danger"
              :disabled="!keys.length"
              @click="clearGroup"
            >
              {{ $t('pages.system.cache.clearGroupBtn') }}
            </ElButton>
          </div>
          <ElTable v-loading="keyLoading" :data="keys" border>
            <ElTableColumn type="index" label="#" width="50" />
            <ElTableColumn :label="$t('pages.system.cache.colKey')" min-width="260">
              <template #default="{ row }">{{ row }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.cache.colOperation')" width="150">
              <template #default="{ row }">
                <ElButton link type="primary" size="small" @click="viewKey(row)">{{
                  $t('pages.system.cache.viewBtn')
                }}</ElButton>
                <ElButton
                  v-perm="'sys:cache:manage'"
                  link
                  type="danger"
                  size="small"
                  @click="removeKey(row)"
                  >{{ $t('pages.system.cache.clearBtn') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElDialog
      v-if="viewVisible"
      v-model="viewVisible"
      :title="$t('pages.system.cache.detailTitle')"
      width="560px"
      destroy-on-close
      @closed="viewVisible = false"
    >
      <ElDescriptions :column="1" border>
        <ElDescriptionsItem :label="$t('pages.system.cache.colKey')"
          ><span class="cache-key">{{ detail.key }}</span></ElDescriptionsItem
        >
        <ElDescriptionsItem :label="$t('pages.system.cache.detailType')">{{
          detail.type
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.cache.detailTtl')">{{
          detail.ttl
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.cache.detailValue')">
          <pre class="cache-value">{{ detail.value }}</pre>
        </ElDescriptionsItem>
      </ElDescriptions>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref, onMounted, onDeactivated } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { fetchCacheGroups, fetchCacheKeys, fetchCacheValue, fetchRemoveCache } from '@/api/cache'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Cache' })

  const { t } = useI18n()

  const groupTableRef = ref<any>(null)
  const groups = ref<any[]>([])
  const groupLoading = ref(false)
  const selectedGroup = ref<any>(null)
  const keys = ref<string[]>([])
  const keyLoading = ref(false)
  const viewVisible = ref(false)
  const detail = reactive<any>({ key: '', type: '', ttl: '', value: '' })

  const loadGroups = async () => {
    groupLoading.value = true
    try {
      groups.value = (await fetchCacheGroups()) || []
      if (groups.value.length) {
        const keep = selectedGroup.value
          ? groups.value.find((g) => g.name === selectedGroup.value.name)
          : null
        onGroupSelect(keep || groups.value[0])
      } else {
        selectedGroup.value = null
        keys.value = []
      }
    } finally {
      groupLoading.value = false
    }
  }

  const onGroupSelect = (row: any) => {
    if (!row) return
    selectedGroup.value = row
    groupTableRef.value?.setCurrentRow(row)
    loadKeys()
  }

  const loadKeys = async () => {
    if (!selectedGroup.value) return
    keyLoading.value = true
    try {
      keys.value = (await fetchCacheKeys(selectedGroup.value.name)) || []
    } finally {
      keyLoading.value = false
    }
  }

  const viewKey = async (key: string) => {
    const info = await fetchCacheValue(key)
    Object.assign(detail, info || {})
    viewVisible.value = true
  }

  const removeKey = (key: string) => {
    ElMessageBox.confirm(
      t('pages.system.cache.clearKeyConfirm', { name: key }),
      t('pages.system.cache.clearTitle'),
      { type: 'warning' }
    )
      .then(async () => {
        await fetchRemoveCache([key])
        ElMessage.success(t('pages.system.cache.clearSuccess'))
        loadKeys()
        loadGroups()
      })
      .catch(() => {})
  }

  const clearGroup = () => {
    ElMessageBox.confirm(
      t('pages.system.cache.clearGroupConfirm', {
        name: selectedGroup.value.name,
        count: keys.value.length
      }),
      t('pages.system.cache.clearGroupTitle'),
      {
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveCache([...keys.value])
        ElMessage.success(t('pages.system.cache.clearAllSuccess'))
        loadKeys()
        loadGroups()
      })
      .catch(() => {})
  }

  onMounted(loadGroups)

  onDeactivated(() => {
    viewVisible.value = false
    ElMessageBox.close()
  })
</script>

<style lang="scss" scoped>
  .cache-page {
    .panel-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      .panel-title {
        font-weight: 500;
      }
    }

    :deep(.el-table__body tr) {
      cursor: pointer;
    }

    .cache-key {
      word-break: break-all;
    }

    .cache-value {
      max-width: 100%;
      max-height: 200px;
      margin: 0;
      overflow: auto;
      font-size: 12px;
      word-break: break-all;
      white-space: pre-wrap;
    }
  }
</style>
