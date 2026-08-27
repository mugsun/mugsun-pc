<!-- 版本更新记录管理：分页 CRUD + 类型分类 + 富文本 -->
<template>
  <div class="changelog-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton
            v-perm="'sys:changelog:manage'"
            type="primary"
            @click="showDialog('add')"
            v-ripple
            >{{ $t('pages.system.changelog.addRecord') }}</ElButton
          >
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="
        form.id
          ? $t('pages.system.changelog.editRecordTitle')
          : $t('pages.system.changelog.addRecordTitle')
      "
      width="780px"
      top="6vh"
      class="changelog-dialog"
      destroy-on-close
    >
      <ElForm :model="form" label-width="80px">
        <ElFormItem :label="$t('pages.system.changelog.version')" required>
          <ElInput
            v-model="form.version"
            :placeholder="$t('pages.system.changelog.versionPlaceholder')"
            style="width: 220px"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.type')" required>
          <ElSelect v-model="form.type" style="width: 220px">
            <ElOption v-for="t in TYPES" :key="t.value" :label="$t(t.label)" :value="t.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.title')" required>
          <ElInput
            v-model="form.title"
            :placeholder="$t('pages.system.changelog.titlePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.publishTime')">
          <ElDatePicker
            v-model="form.publishTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            :placeholder="$t('pages.system.changelog.publishTimePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.sort')">
          <ElInputNumber v-model="form.sort" :min="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.content')">
          <ArtWangEditor v-model="form.content" height="280px" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, onDeactivated, reactive } from 'vue'
  import { ElButton, ElTag, ElMessage, ElMessageBox } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtWangEditor from '@/components/core/forms/art-wang-editor/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { hasPerm } from '@/utils/permission'
  import { formatTableTime } from '@/utils/date'
  import {
    fetchChangelogPage,
    fetchChangelogDetail,
    fetchSaveChangelog,
    fetchRemoveChangelog
  } from '@/api/feedback'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'ChangeLog' })

  const { t } = useI18n()

  const TYPES = [
    { label: 'pages.system.changelog.typeFeature', value: 'feature', tag: 'primary' },
    { label: 'pages.system.changelog.typeOptimize', value: 'optimize', tag: 'warning' },
    { label: 'pages.system.changelog.typeFix', value: 'fix', tag: 'danger' }
  ]
  const typeMeta = (v: string) => {
    const hit = TYPES.find((x) => x.value === v)
    return hit ? { label: t(hit.label), tag: hit.tag } : { label: v, tag: 'info' }
  }

  // 语义版本比较（v1.3.0 > v1.10.0）：非数字段兜底字符串比较，非法版本排最后
  const compareVersion = (a: string, b: string): number => {
    const pa = String(a || '')
      .replace(/^v/i, '')
      .split('.')
    const pb = String(b || '')
      .replace(/^v/i, '')
      .split('.')
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i]
      const nb = pb[i]
      if (na === undefined) return -1
      if (nb === undefined) return 1
      const diff =
        /^\d+$/.test(na) && /^\d+$/.test(nb) ? Number(na) - Number(nb) : na.localeCompare(nb)
      if (diff !== 0) return diff
    }
    return 0
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: fetchChangelogPage,
      apiParams: { pageNum: 1, pageSize: 10 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { prop: 'version', label: t('pages.system.changelog.version'), width: 120 },
        {
          prop: 'type',
          label: t('pages.system.changelog.type'),
          width: 100,
          formatter: (row: any) => {
            const m = typeMeta(row.type)
            return h(ElTag, { type: m.tag as any }, () => m.label)
          }
        },
        { prop: 'title', label: t('pages.system.changelog.title'), minWidth: 220 },
        {
          prop: 'publishTime',
          label: t('pages.system.changelog.publishTime'),
          minWidth: 170,
          formatter: (row: any) => formatTableTime(row.publishTime)
        },
        { prop: 'sort', label: t('pages.system.changelog.sort'), width: 80 },
        {
          prop: 'operation',
          label: t('pages.system.changelog.colOperation'),
          width: 140,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
          formatter: (row: any) =>
            h('div', [
              hasPerm('sys:changelog:manage')
                ? h(ArtButtonTable, { type: 'edit', onClick: () => showDialog('edit', row) })
                : null,
              hasPerm('sys:changelog:manage')
                ? h(ArtButtonTable, { type: 'delete', onClick: () => remove(row) })
                : null
            ])
        }
      ]
    },
    transform: {
      // 后端按 sort 字段倒序返回（sort 默认 0，新版本易排老版本后），前端按语义版本倒序重排
      responseAdapter: (resp: any) => ({
        records: [...(resp?.records ?? [])].sort((a: any, b: any) =>
          compareVersion(b.version, a.version)
        ),
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 10
      })
    }
  })

  const dialogVisible = ref(false)
  const submitting = ref(false)
  const form = reactive<any>({
    id: undefined,
    version: '',
    type: 'feature',
    title: '',
    content: '',
    publishTime: '',
    sort: 0
  })

  const closeDialog = (): void => {
    dialogVisible.value = false
  }

  const showDialog = async (type: 'add' | 'edit', row?: any) => {
    if (type === 'add') {
      Object.assign(form, {
        id: undefined,
        version: '',
        type: 'feature',
        title: '',
        content: '',
        publishTime: '',
        sort: 0
      })
    } else {
      const detail = await fetchChangelogDetail(row.id)
      Object.assign(form, {
        id: detail.id,
        version: detail.version,
        type: detail.type,
        title: detail.title,
        content: detail.content || '',
        publishTime: detail.publishTime || '',
        sort: detail.sort
      })
    }
    dialogVisible.value = true
  }

  const submit = async () => {
    if (!form.version?.trim() || !form.title?.trim()) {
      return ElMessage.warning(t('pages.system.changelog.versionTitleRequired'))
    }
    submitting.value = true
    try {
      await fetchSaveChangelog({ ...form })
      ElMessage.success(t('pages.system.changelog.saveSuccess'))
      dialogVisible.value = false
      refreshData()
    } finally {
      submitting.value = false
    }
  }

  const remove = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.changelog.removeConfirm', { version: row.version, title: row.title }),
      t('pages.system.changelog.removeTitle'),
      {
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveChangelog([row.id])
        ElMessage.success(t('pages.system.changelog.removeSuccess'))
        refreshData()
      })
      .catch(() => {})
  }

  onDeactivated(() => {
    ElMessageBox.close()
    closeDialog()
  })
</script>

<!-- 弹窗内容 teleport 到 body，表单项+富文本叠加超高时需非 scoped 类限定滚动（同 notice-dialog 范式），防矮视口下操作按钮挤出视口 -->
<style>
  .changelog-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
