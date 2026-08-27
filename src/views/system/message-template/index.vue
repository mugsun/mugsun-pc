<!-- 站内信模板管理：title/content 含 ${key} 占位 -->
<template>
  <div class="msg-template-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton
            v-perm="'sys:message:manage'"
            type="primary"
            @click="showDialog('add')"
            v-ripple
            >{{ $t('pages.system.messageTemplate.addBtn') }}</ElButton
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
          ? $t('pages.system.messageTemplate.editTitle')
          : $t('pages.system.messageTemplate.addBtn')
      "
      width="640px"
    >
      <ElForm :model="form" label-width="80px">
        <ElFormItem :label="$t('pages.system.messageTemplate.codeLabel')" required>
          <ElInput
            v-model="form.code"
            :disabled="!!form.id"
            :placeholder="$t('pages.system.messageTemplate.codePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.messageTemplate.titleLabel')" required>
          <ElInput
            v-model="form.title"
            :placeholder="
              $t('pages.system.messageTemplate.titlePlaceholder', {
                key: '{key}',
                name: '{name}'
              })
            "
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.messageTemplate.contentLabel')">
          <ElInput
            v-model="form.content"
            type="textarea"
            :rows="5"
            :placeholder="
              $t('pages.system.messageTemplate.contentPlaceholder', {
                key: '{key}',
                name: '{name}',
                role: '{role}'
              })
            "
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="dialogSaving" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" @click="submit">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, reactive } from 'vue'
  import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import { hasPerm } from '@/utils/permission'
  import {
    fetchMsgTemplatePage,
    fetchMsgTemplateDetail,
    fetchSaveMsgTemplate,
    fetchRemoveMsgTemplate
  } from '@/api/message'
  import { formatTableTime } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'MessageTemplate' })

  const { t } = useI18n()

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
      apiFn: fetchMsgTemplatePage,
      apiParams: { pageNum: 1, pageSize: 10 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { prop: 'code', label: t('pages.system.messageTemplate.colCode'), width: 160 },
        { prop: 'title', label: t('pages.system.messageTemplate.titleLabel'), minWidth: 220 },
        {
          prop: 'createTime',
          label: t('pages.system.messageTemplate.colCreateTime'),
          minWidth: 180,
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.messageTemplate.colOperation'),
          width: 140,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
          formatter: (row: any) =>
            h('div', { class: 'flex gap-1' }, [
              hasPerm('sys:message:manage')
                ? h(
                    ElButton,
                    {
                      size: 'small',
                      link: true,
                      type: 'primary',
                      onClick: () => showDialog('edit', row)
                    },
                    () => t('common.edit')
                  )
                : null,
              hasPerm('sys:message:manage')
                ? h(
                    ElButton,
                    {
                      size: 'small',
                      link: true,
                      type: 'danger',
                      onClick: () => remove(row)
                    },
                    () => t('common.delete')
                  )
                : null
            ])
        }
      ]
    },
    transform: {
      responseAdapter: (resp: any) => ({
        records: resp?.records ?? [],
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 10
      })
    }
  })

  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const form = reactive<any>({ id: undefined, code: '', title: '', content: '' })

  const showDialog = async (type: 'add' | 'edit', row?: any) => {
    if (type === 'add') {
      Object.assign(form, { id: undefined, code: '', title: '', content: '' })
    } else {
      const detail = await fetchMsgTemplateDetail(row.id)
      Object.assign(form, {
        id: detail.id,
        code: detail.code,
        title: detail.title,
        content: detail.content || ''
      })
    }
    dialogVisible.value = true
  }

  const submit = async () => {
    if (!form.code?.trim() || !form.title?.trim()) {
      return ElMessage.warning(t('pages.system.messageTemplate.requiredWarning'))
    }
    dialogSaving.value = true
    try {
      await fetchSaveMsgTemplate({ ...form })
      ElMessage.success(t('pages.system.messageTemplate.saveSuccess'))
      dialogVisible.value = false
      refreshData()
    } finally {
      dialogSaving.value = false
    }
  }

  const remove = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.messageTemplate.deleteConfirm', { name: row.code }),
      t('pages.system.messageTemplate.deleteTitle'),
      { type: 'warning' }
    ).then(async () => {
      await fetchRemoveMsgTemplate([row.id])
      ElMessage.success(t('pages.system.messageTemplate.deleteSuccess'))
      refreshData()
    })
  }
</script>
