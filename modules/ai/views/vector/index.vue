<template>
  <div class="ai-crud-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="按名称搜索"
          style="width: 200px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">创建向量库</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard v-for="row in records" :key="row.id" shadow="hover">
          <div class="title"
            >{{ row.name }}
            <ElTag v-if="row.builtinFlag === 1" size="small">内置</ElTag>
            <ElTag size="small" effect="plain">{{ typeLabel(row.storeType || row.type) }}</ElTag>
          </div>
          <div class="meta"
            >{{ row.host || row.url || '-' }} · 维度 {{ row.dimensions || '-' }}</div
          >
          <div class="ops">
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
            <ElButton link @click="test(row)">测试连接</ElButton>
            <ElButton link type="danger" :disabled="row.builtinFlag === 1" @click="remove(row)"
              >删除</ElButton
            >
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" :description="emptyText" />
      </div>
      <ElPagination
        class="pager"
        v-model:current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="reload"
      />
    </ElCard>
    <ElDialog
      v-model="visible"
      class="ai-vector-dialog"
      :title="form.id ? '编辑向量库' : '创建向量库'"
      width="560px"
    >
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="名称" required>
          <ElInput v-model="form.name" maxlength="64" placeholder="用来在列表里区分" />
        </ElFormItem>
        <ElFormItem label="类型" required>
          <ElSelect v-model="form.storeType" style="width: 100%">
            <ElOption label="PgVector" value="pgvector" />
            <ElOption label="Milvus" value="milvus" />
            <ElOption label="自定义" value="custom" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="连接地址" required>
          <ElInput v-model="form.url" placeholder="jdbc:postgresql://主机:端口/库名" />
        </ElFormItem>
        <ElFormItem label="维度"><ElInputNumber v-model="form.dimensions" :min="1" /></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="form.remark" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessageBox } from 'element-plus'
  import {
    fetchAiVectorPage,
    fetchRemoveAiVector,
    fetchSaveAiVector,
    fetchTestAiVector
  } from '../../api'
  defineOptions({ name: 'AiVector' })
  const TYPE_LABEL: Record<string, string> = {
    pgvector: 'PgVector',
    milvus: 'Milvus',
    custom: '自定义'
  }
  const keyword = ref('')
  const searched = ref(false)
  const loading = ref(false)
  const records = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(12)
  const total = ref(0)
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  const emptyText = computed(() =>
    searched.value ? '没有符合条件的向量库。换个名称再查' : '还没有向量库。点创建向量库开始配置'
  )
  function typeLabel(type?: string) {
    return TYPE_LABEL[type || ''] || type || ''
  }
  async function reload() {
    loading.value = true
    const name = keyword.value.trim()
    searched.value = name.length > 0
    try {
      const res = await fetchAiVectorPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        name: name || undefined
      })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : { storeType: 'pgvector', dimensions: 1536 })
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await fetchSaveAiVector({
        id: form.id,
        name: form.name,
        storeType: form.storeType,
        url: form.url,
        dimensions: form.dimensions,
        remark: form.remark
      })
      visible.value = false
      await reload()
    } catch {
      /* 失败提示由请求层展示，弹窗留着方便改完再存 */
    } finally {
      saving.value = false
    }
  }
  async function test(row: any) {
    try {
      await fetchTestAiVector(row.id)
    } catch {
      /* 没连上时请求层会用服务器说明，不能再显示成成功 */
    }
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      `删除「${row.name || '这个向量库'}」后，列表里不会再出现，知识库检索也不会再用它`,
      '确认'
    )
    await fetchRemoveAiVector(row.id)
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

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
    min-height: 160px;
  }

  .title {
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }

  .meta {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
    margin-top: 10px;
  }

  .pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
