<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="$router.back()">返回</ElButton>
        <h3>仪表盘设计 #{{ dashId }}</h3>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
        <ElButton @click="share">分享</ElButton>
      </div>
      <ElForm label-width="88px" style="max-width: 640px; margin-bottom: 12px">
        <ElFormItem label="名称"><ElInput v-model="name" /></ElFormItem>
      </ElForm>
      <ElAlert
        type="info"
        :closable="false"
        title="简化模式：编辑仪表盘 DSL JSON（图表布局/绑定问数会话）。"
        style="margin-bottom: 12px"
      />
      <ElInput v-model="dslText" type="textarea" :rows="20" />
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import {
    fetchAiDashboardDetail,
    fetchSaveAiDashboard,
    fetchSaveAiDashboardDsl,
    fetchShareAiDashboard
  } from '../../api'
  defineOptions({ name: 'AiDashboardDesign' })
  const route = useRoute()
  // 路由参数既可能是 dashboard id，也可能从问数入口带 datasetId
  const dashId = computed(() => route.params.id as string)
  const name = ref('未命名仪表盘')
  const dslText = ref(JSON.stringify({ charts: [] }, null, 2))
  const saving = ref(false)
  const entityId = ref<string | number | null>(null)

  async function load() {
    try {
      const d = await fetchAiDashboardDetail(dashId.value)
      if (d?.id) {
        entityId.value = d.id
        name.value = d.name || name.value
        if (d.dslJson) {
          try {
            dslText.value = JSON.stringify(JSON.parse(d.dslJson), null, 2)
          } catch {
            dslText.value = d.dslJson
          }
        }
      }
    } catch {
      // 可能是 datasetId 入口：新建
      entityId.value = null
    }
  }
  async function save() {
    saving.value = true
    try {
      JSON.parse(dslText.value)
      if (!entityId.value) {
        const created = await fetchSaveAiDashboard({
          name: name.value,
          datasetId: dashId.value,
          dslJson: dslText.value
        })
        entityId.value = created?.id || entityId.value
      } else {
        await fetchSaveAiDashboardDsl({
          id: entityId.value,
          name: name.value,
          dslJson: dslText.value
        })
      }
      ElMessage.success('已保存')
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      saving.value = false
    }
  }
  async function share() {
    if (!entityId.value) {
      ElMessage.warning('请先保存')
      return
    }
    const r = await fetchShareAiDashboard({ id: entityId.value })
    ElMessage.success(r?.url ? `分享链接：${r.url}` : '已生成分享')
  }
  onMounted(load)
</script>
<style scoped>
  .hd {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }

  .hd h3 {
    flex: 1;
    margin: 0;
    font-size: 16px;
  }
</style>
