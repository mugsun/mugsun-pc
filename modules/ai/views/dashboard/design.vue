<template>
  <div class="art-full-height">
    <AiNotFound
      v-if="notFound"
      :what="$t('aiDashDesign.what')"
      :id="dashId"
      back-path="/ai/dataset"
      :back-text="$t('aiDashDesign.backToList')"
    />
    <ElCard v-else class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="router.push('/ai/dataset')">{{ $t('aiDashDesign.back') }}</ElButton>
        <h3>{{ $t('aiDashDesign.title', { id: dashId }) }}</h3>
        <ElButton type="primary" :loading="saving" @click="save">{{
          $t('aiDashDesign.save')
        }}</ElButton>
        <ElButton @click="share">{{ $t('aiDashDesign.share') }}</ElButton>
        <ElButton type="danger" plain :disabled="!entityId" @click="remove">{{
          $t('aiDashDesign.delete')
        }}</ElButton>
      </div>
      <ElForm label-width="88px" style="max-width: 640px; margin-bottom: 12px">
        <ElFormItem :label="$t('aiDashDesign.name')" required>
          <ElInput
            v-model="name"
            maxlength="64"
            show-word-limit
            :placeholder="$t('aiDashDesign.namePlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <ElAlert
        type="info"
        :closable="false"
        :title="$t('aiDashDesign.tip')"
        style="margin-bottom: 12px"
      />
      <ElInput v-model="dslText" type="textarea" :rows="8" />
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { computed, onMounted, ref } from 'vue'
  import AiNotFound from '../shared/AiNotFound.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiDashboardDetail,
    fetchRemoveAiDashboard,
    fetchSaveAiDashboard,
    fetchSaveAiDashboardDsl,
    fetchShareAiDashboard,
    aiDatasetExists
  } from '../../api'
  defineOptions({ name: 'AiDashboardDesign' })
  const { t } = useI18n()
  /** id 不存在或已删除时只显示占位与返回入口（UX-105） */
  const notFound = ref(false)
  const route = useRoute()
  const router = useRouter()
  // 路由参数既可能是 dashboard id，也可能从问数入口带 datasetId
  const dashId = computed(() => route.params.id as string)
  const name = ref(t('aiDashDesign.untitled'))
  const dslText = ref(JSON.stringify({ charts: [] }, null, 2))
  const saving = ref(false)
  const entityId = ref<string | number | null>(null)

  async function load() {
    const currentId = String(dashId.value || '')
    if (!/^\d{1,19}$/.test(currentId)) {
      notFound.value = true
      return
    }
    try {
      const d = await fetchAiDashboardDetail(currentId, { showErrorMessage: false })
      if (!d?.id) {
        entityId.value = null
        // 参数也可能是 datasetId（从问数入口新建）：数据集也不存在才算找不到
        if (!(await aiDatasetExists(currentId))) notFound.value = true
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
      if (!(await aiDatasetExists(currentId))) notFound.value = true
    }
  }
  async function save() {
    saving.value = true
    try {
      JSON.parse(dslText.value)
    } catch {
      saving.value = false
      ElMessage.error(t('aiDashDesign.dslInvalid', { example: '{"charts":[]}' }))
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
      ElMessage.warning(t('aiDashDesign.saveFirst'))
      return
    }
    const r = await fetchShareAiDashboard({ id: entityId.value })
    await ElMessageBox.alert(String(r?.url || ''), t('aiDashDesign.shareTip'))
  }
  async function remove() {
    if (!entityId.value) return
    await ElMessageBox.confirm(
      t('aiDashDesign.removeConfirm', { name: name.value }),
      t('aiDashDesign.confirmTitle')
    )
    await fetchRemoveAiDashboard(entityId.value)
    entityId.value = null
    name.value = t('aiDashDesign.untitled')
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
