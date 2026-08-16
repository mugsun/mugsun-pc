<!-- 底图配置：全幅地图预览 + 左侧供应商 HUD。 -->
<template>
  <div class="gis-shell art-full-height">
    <div class="gis-map-shell">
      <div ref="mapHost" class="gis-map"></div>
      <aside class="gis-hud gis-hud-panel gis-hud-panel-wide">
        <p class="gis-panel-lead">{{ $t('pages.gis.secretHint') }}</p>
        <div
          v-for="card in cards"
          :key="card.provider"
          class="gis-provider-card"
          :class="{ 'is-on': selected === card.provider }"
          @click="pick(card.provider)"
        >
          <div class="gis-provider-head">
            <strong>{{ $t(`pages.gis.provider${cap(card.provider)}`) }}</strong>
            <ElTag :type="card.configured ? 'success' : 'info'" size="small">
              {{ card.configured ? $t('pages.gis.configured') : $t('pages.gis.notConfigured') }}
            </ElTag>
          </div>
          <template v-if="selected === card.provider">
            <ElForm label-position="top" size="small" @click.stop>
              <ElFormItem :label="$t('pages.gis.keyLabel')">
                <ElInput
                  v-model="draft[card.provider].apiKey"
                  show-password
                  :placeholder="
                    card.configured ? $t('pages.gis.keyKeepHint') : $t('pages.gis.keyPlaceholder')
                  "
                />
              </ElFormItem>
              <ElFormItem :label="$t('pages.gis.enabled')">
                <ElSwitch
                  v-model="draft[card.provider].enabled"
                  :active-value="1"
                  :inactive-value="0"
                />
              </ElFormItem>
            </ElForm>
            <div class="gis-provider-actions" @click.stop>
              <ElButton
                v-perm="'gis:provider:save'"
                type="primary"
                size="small"
                :loading="saving === card.provider"
                @click="save(card.provider)"
              >
                {{ $t('pages.gis.save') }}
              </ElButton>
              <ElButton
                v-if="card.id"
                v-perm="'gis:provider:remove'"
                size="small"
                type="danger"
                plain
                @click="remove(card)"
              >
                {{ $t('pages.gis.remove') }}
              </ElButton>
            </div>
          </template>
        </div>
        <ul class="gis-help-mini">
          <li>{{ $t('pages.gis.helpTianditu') }}</li>
          <li>{{ $t('pages.gis.helpAmap') }}</li>
          <li>{{ $t('pages.gis.helpBaidu') }}</li>
          <li>{{ $t('pages.gis.helpGoogle') }}</li>
        </ul>
      </aside>
      <div class="gis-hud gis-hud-tr">
        <ElSelect v-model="baseStyle" class="gis-style-select" @change="applyPreview">
          <ElOption value="vec" :label="$t('pages.gis.styleVec')" />
          <ElOption value="img" :label="$t('pages.gis.styleImg')" />
          <ElOption value="img_label" :label="$t('pages.gis.styleImgLabel')" />
          <ElOption value="vec_label" :label="$t('pages.gis.styleVecLabel')" />
        </ElSelect>
      </div>
      <p class="gis-hud gis-hud-status">{{ $t('pages.gis.providerCoach') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchGisStatus,
    fetchSaveGisProvider,
    fetchRemoveGisProvider,
    type GisProviderStatus
  } from '@/api/gis'
  import { bootLabMap, type LabMapBag } from '@/gis/labBoot'
  import { applyOlBasemap } from '@/gis/olMap'
  import type { GisProviderCode, GisStyleCode } from '@/gis/types'

  defineOptions({ name: 'GisProvider' })

  const { t } = useI18n()
  const mapHost = ref<HTMLElement>()
  const cards = ref<GisProviderStatus[]>([])
  const selected = ref('tianditu')
  const saving = ref('')
  const baseStyle = ref<GisStyleCode>('img_label')
  const draft = reactive<Record<string, { apiKey: string; enabled: number }>>({
    tianditu: { apiKey: '', enabled: 1 },
    amap: { apiKey: '', enabled: 1 },
    baidu: { apiKey: '', enabled: 1 },
    google: { apiKey: '', enabled: 1 }
  })
  let bag: LabMapBag | undefined

  const cap = (code: string): string => {
    if (code === 'tianditu') return 'Tianditu'
    if (code === 'amap') return 'Amap'
    if (code === 'baidu') return 'Baidu'
    return 'Google'
  }

  const applyPreview = (): void => {
    if (!bag) {
      return
    }
    try {
      applyOlBasemap(bag.map, selected.value as GisProviderCode, baseStyle.value)
    } catch {
      // 未配密钥时底图可空白
    }
    bag.map.updateSize()
  }

  const pick = (provider: string): void => {
    selected.value = provider
    applyPreview()
  }

  const load = async (): Promise<void> => {
    const status = await fetchGisStatus()
    cards.value = status.providers ?? []
    for (const row of cards.value) {
      draft[row.provider] = {
        apiKey: '',
        enabled: row.configured ? (row.enabled ? 1 : 0) : 1
      }
    }
    const ready = cards.value.find((row) => row.enabled && row.configured)
    if (ready && !cards.value.find((row) => row.provider === selected.value)?.configured) {
      selected.value = ready.provider
    }
    applyPreview()
  }

  const save = async (provider: string): Promise<void> => {
    saving.value = provider
    try {
      const body: Record<string, unknown> = {
        provider,
        enabled: draft[provider].enabled
      }
      if (draft[provider].apiKey.trim()) {
        body.apiKey = draft[provider].apiKey.trim()
      }
      await fetchSaveGisProvider(body)
      draft[provider].apiKey = ''
      ElMessage.success(t('pages.gis.saveSuccess'))
      await load()
    } finally {
      saving.value = ''
    }
  }

  const remove = (card: GisProviderStatus): void => {
    if (!card.id) return
    ElMessageBox.confirm(
      t('pages.gis.removeConfirm', { name: t(`pages.gis.provider${cap(card.provider)}`) }),
      t('pages.gis.removeTitle'),
      { type: 'warning' }
    ).then(async () => {
      await fetchRemoveGisProvider([card.id!])
      ElMessage.success(t('pages.gis.removeSuccess'))
      await load()
    })
  }

  onMounted(async () => {
    const status = await fetchGisStatus()
    const first = status.providers.find((p) => p.enabled && p.configured)
    const provider = (first?.provider || 'tianditu') as GisProviderCode
    selected.value = provider
    await nextTick()
    if (mapHost.value) {
      bag = await bootLabMap(mapHost.value, provider)
    }
    await load()
  })

  onActivated(() => {
    bag?.map.updateSize()
  })

  onBeforeUnmount(() => {
    bag?.destroy()
    bag = undefined
  })
</script>

<style src="../gis-shell.css"></style>
<style scoped>
  .gis-hud-panel-wide {
    overflow: auto;
  }

  .gis-panel-lead {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .gis-provider-card {
    padding: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    border: 1px solid var(--el-border-color-extra-light);
    border-radius: 8px;
  }

  .gis-provider-card.is-on {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
  }

  .gis-provider-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gis-provider-actions {
    display: flex;
    gap: 8px;
  }

  .gis-style-select {
    width: 108px;
  }

  .gis-help-mini {
    padding-left: 16px;
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }
</style>
