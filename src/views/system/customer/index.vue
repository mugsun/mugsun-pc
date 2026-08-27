<!-- 客户管理（演示业务，对接 /system/customer）：数据按当前租户的独立数据源路由 -->
<template>
  <div class="customer-page art-full-height">
    <ElCard class="art-table-card">
      <div class="customer-toolbar">
        <ElButton type="primary" @click="showCreate">{{
          $t('pages.system.customer.create')
        }}</ElButton>
      </div>

      <!-- 表格为自由增长内容：art-table-card 卡片体是 height:100%+overflow:hidden 裁剪，
           内部须自备滚动，否则矮视口下底部行被切断且不可达（同 track/user 修法） -->
      <div v-loading="loading" class="customer-table-wrap">
        <ElTable :data="tableData" border>
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn prop="tenantId" :label="$t('pages.system.customer.tenant')" width="120" />
          <ElTableColumn prop="name" :label="$t('pages.system.customer.name')" min-width="160" />
          <ElTableColumn prop="phone" :label="$t('pages.system.customer.phone')" min-width="140" />
          <ElTableColumn
            prop="remark"
            :label="$t('pages.system.customer.remark')"
            min-width="160"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.customer.actions')" width="100" fixed="right">
            <template #default="{ row }">
              <ElButton link type="danger" @click="remove(row)">{{
                $t('pages.system.customer.delete')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <!-- 分页器放滚动区外并禁止收缩：翻页始终可见可达（同 mail-template 范式） -->
      <div class="customer-pager">
        <ElPagination
          v-model:current-page="pageNum"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          background
          @current-change="loadData"
        />
      </div>
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="$t('pages.system.customer.create')"
      width="500px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.customer.name')" prop="name">
          <ElInput v-model="form.name" :placeholder="$t('pages.system.customer.namePlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.customer.phone')" prop="phone">
          <ElInput
            v-model="form.phone"
            :placeholder="$t('pages.system.customer.phonePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.customer.remark')">
          <ElInput
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('pages.system.customer.remarkPlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" @click="submit">{{
          $t('pages.system.customer.save')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onDeactivated, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { fetchCustomerPage, fetchSubmitCustomer, fetchRemoveCustomer } from '@/api/datasource'

  defineOptions({ name: 'Customer' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const formRef = ref<FormInstance>()

  const form = reactive<Record<string, any>>({ name: '', phone: '', remark: '' })

  const rules: FormRules = {
    name: [{ required: true, message: t('pages.system.customer.namePlaceholder'), trigger: 'blur' }]
  }

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const resp = await fetchCustomerPage({ pageNum: pageNum.value, pageSize: pageSize.value })
      tableData.value = resp?.records ?? []
      total.value = resp?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  const showCreate = (): void => {
    Object.assign(form, { name: '', phone: '', remark: '' })
    dialogVisible.value = true
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      dialogSaving.value = true
      try {
        await fetchSubmitCustomer({ ...form })
        ElMessage.success(t('pages.system.customer.msgSaved'))
        dialogVisible.value = false
        loadData()
      } finally {
        dialogSaving.value = false
      }
    })
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.customer.confirmDelete', { name: row.name }),
      t('pages.system.customer.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveCustomer(row.id)
        ElMessage.success(t('pages.system.customer.msgDeleted'))
        loadData()
      })
      .catch(() => {
        /* cancel */
      })
  }

  const closeOverlays = (): void => {
    dialogVisible.value = false
    ElMessageBox.close()
  }

  onDeactivated(closeOverlays)
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
  onBeforeUnmount(closeOverlays)
</script>

<style scoped>
  /* 卡片体改为纵向 flex，表格滚动区占满剩余高度（滚动区见模板注释） */
  .customer-page :deep(.art-table-card > .el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .customer-toolbar {
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .customer-table-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .customer-pager {
    display: flex;
    flex-shrink: 0;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
