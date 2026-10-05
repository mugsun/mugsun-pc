<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="router.push('/ai/dataset')">返回</ElButton>
        <h3>仪表盘设计 #{{ dashId }}</h3>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
        <ElButton @click="share">分享</ElButton>
        <ElButton type="danger" plain :disabled="!entityId" @click="remove">删除</ElButton>
      </div>
      <ElForm label-width="88px" style="max-width: 640px; margin-bottom: 12px">
        <ElFormItem label="名称" required>
          <ElInput v-model="name" maxlength="64" show-word-limit placeholder="用来在列表里区分" />
        </ElFormItem>
      </ElForm>
      <ElAlert
        type="info"
        :closable="false"
        title="在下面编辑 JSON。保存后可以分享站内地址，对方登录并有权限才能打开。"
        style="margin-bottom: 12px"
      />
      <ElInput v-model="dslText" type="textarea" :rows="8" />
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiDashboardDetail,
    fetchRemoveAiDashboard,
    fetchSaveAiDashboard,
    fetchSaveAiDashboardDsl,
    fetchShareAiDashboard
  } from '../../api'
  defineOptions({ name: 'AiDashboardDesign' })
  const route = useRoute()
  const router = useRouter()
  // 路由参数既可能是 dashboard id，也可能从问数入口带 datasetId
  const dashId = computed(() => route.params.id as string)
  const name = ref('未命名仪表盘')
  const dslText = ref(JSON.stringify({ charts: [] }, null, 2))
  const saving = ref(false)
  const entityId = ref<string | number | null>(null)

  async function load() {
    const currentId = String(dashId.value || '')
    if (!/^\d{1,19}$/.test(currentId)) return
    try {
      const d = await fetchAiDashboardDetail(currentId)
      if (!d?.id) {
        entityId.value = null
        return
      }
      entityId.value = d.id
      name.value = d.name || name.value
      const raw = d.dslJson || d.dsl
      if (raw) {
        try {
          dslText.value = JSON.stringify(JSON.parse(raw), null, 2)
        } catch {
          dslText.value = raw
        }
      }
      if (String(d.id) !== String(dashId.value)) {
        await router.replace(`/ai/dashboard/design/${d.id}`)
      }
    } catch {
      entityId.value = null
    }
  }
  async function save() {
    saving.value = true
    try {
      JSON.parse(dslText.value)
    } catch {
      saving.value = false
      ElMessage.error('DSL 不是合法 JSON。可以先写成 {"charts":[]} 再改')
      return
    }
    try {
      if (!entityId.value) {
        const created = await fetchSaveAiDashboard({
          name: name.value,
          datasetId: dashId.value,
          dslJson: dslText.value
        })
        entityId.value = created?.id || entityId.value
        if (created?.id && String(created.id) !== String(dashId.value)) {
          await router.replace(`/ai/dashboard/design/${created.id}`)
        }
      } else {
        await fetchSaveAiDashboardDsl({
          id: entityId.value,
          name: name.value,
          dslJson: dslText.value
        })
      }
    } catch {
      /* 失败时名称和 DSL 留着，方便改完再保存 */
    } finally {
      saving.value = false
    }
  }
  async function share() {
    if (!entityId.value) {
      ElMessage.warning('请先保存仪表盘，再分享')
      return
    }
    const r = await fetchShareAiDashboard({ id: entityId.value })
    await ElMessageBox.alert(
      String(r?.url || ''),
      '这是站内地址。对方需要登录，并且有仪表盘权限才能打开'
    )
  }
  async function remove() {
    if (!entityId.value) return
    await ElMessageBox.confirm(`删除「${name.value}」后，问数里再进会是一份新的`, '确认')
    await fetchRemoveAiDashboard(entityId.value)
    entityId.value = null
    name.value = '未命名仪表盘'
    dslText.value = JSON.stringify({ charts: [] }, null, 2)
    router.push('/ai/dataset')
  }
  onMounted(load)
</script>
<style scoped>
  .hd {
    display: flex;
    flex-wrap: wrap;
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
