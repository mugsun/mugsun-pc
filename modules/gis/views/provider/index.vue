<!-- 底图配置：全幅地图预览 + 左侧供应商 HUD。 -->
<template>
  <div class="gis-shell art-full-height">
    <div class="gis-map-shell gis-map-shell--panel">
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
              <template v-if="card.provider === 'xyz'">
                <ElFormItem :label="$t('pages.gis.xyzPreset')">
                  <ElSelect
                    v-model="xyzForm.preset"
                    :placeholder="$t('pages.gis.xyzPresetCustom')"
                    clearable
                    @change="applyXyzPreset"
                  >
                    <ElOption
                      v-for="p in xyzPresets"
                      :key="p.code"
                      :value="p.code!"
                      :label="$t(`pages.gis.xyzPreset_${p.code!.replace('-', '_')}`)"
                    />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem :label="$t('pages.gis.xyzUrl')">
                  <ElInput
                    v-model="xyzForm.url"
                    placeholder="https://{s}.example.com/{z}/{x}/{y}.png"
                  />
                </ElFormItem>
                <ElFormItem :label="$t('pages.gis.xyzSubdomains')">
                  <ElInput v-model="xyzForm.subdomains" placeholder="a,b,c" />
                </ElFormItem>
                <ElFormItem :label="$t('pages.gis.xyzAttribution')">
                  <ElInput v-model="xyzForm.attribution" maxlength="200" />
                </ElFormItem>
                <p class="gis-xyz-hosts">
                  {{ $t('pages.gis.xyzAllowedHosts', { hosts: xyzHosts.join(', ') || '-' }) }}
                </p>
              </template>
              <ElFormItem
                :label="
                  card.provider === 'xyz'
                    ? $t('pages.gis.xyzKeyOptional')
                    : $t('pages.gis.keyLabel')
                "
              >
                <ElInput
                  v-model="draft[card.provider].apiKey"
                  show-password
                  :placeholder="
                    card.configured && card.id
                      ? $t('pages.gis.keyKeepHint')
                      : $t('pages.gis.keyPlaceholder')
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
                v-if="card.provider === 'xyz'"
                v-perm="'gis:provider:save'"
                size="small"
                :loading="testing"
                @click="testXyz"
              >
                {{ $t('pages.gis.xyzTest') }}
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
          <li>{{ $t('pages.gis.helpXyz') }}</li>
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
  import {
    nextTick,
    onActivated,
    onBeforeUnmount,
    onDeactivated,
    onMounted,
    reactive,
    ref
  } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchGisStatus,
    fetchSaveGisProvider,
    fetchRemoveGisProvider,
    fetchGisXyzConfig,
    fetchTestGisProvider,
    type GisProviderStatus,
    type GisXyzTemplate
  } from '@/api/gis'
  import { bootLabMap, type LabMapBag } from '@/gis/labBoot'
  import { rememberedOrFirst } from '@/gis/preferProvider'
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
    google: { apiKey: '', enabled: 1 },
    xyz: { apiKey: '', enabled: 1 }
  })
  const xyzForm = reactive({ preset: '', url: '', subdomains: '', attribution: '' })
  const xyzPresets = ref<GisXyzTemplate[]>([])
  const xyzHosts = ref<string[]>([])
  const testing = ref(false)

  const fillXyz = (t: GisXyzTemplate | null | undefined, preset = ''): void => {
    xyzForm.preset = preset
    xyzForm.url = t?.url ?? ''
    xyzForm.subdomains = (t?.subdomains ?? []).join(',')
    xyzForm.attribution = t?.attribution ?? ''
  }

  const applyXyzPreset = (code: string): void => {
    const hit = xyzPresets.value.find((p) => p.code === code)
    if (hit) fillXyz(hit, code)
  }

  const xyzExtraJson = (): string =>
    JSON.stringify({
      url: xyzForm.url.trim(),
      subdomains: xyzForm.subdomains
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      attribution: xyzForm.attribution.trim()
    })

  const loadXyz = async (): Promise<void> => {
    try {
      const cfg = await fetchGisXyzConfig()
      xyzPresets.value = cfg.presets ?? []
      xyzHosts.value = cfg.allowedHosts ?? []
      const same = xyzPresets.value.find((p) => p.url === cfg.current?.url)
      fillXyz(cfg.current, same?.code ?? '')
    } catch {
      /* 无权限或模块关闭时保持空表单 */
    }
  }

  const testXyz = async (): Promise<void> => {
    testing.value = true
    try {
      const body: Record<string, unknown> = { provider: 'xyz' }
      if (xyzForm.url.trim()) body.extraJson = xyzExtraJson()
      if (draft.xyz.apiKey.trim()) body.apiKey = draft.xyz.apiKey.trim()
      const res = await fetchTestGisProvider(body)
      if (res.ok) {
        ElMessage.success(t('pages.gis.xyzTestOk', { ms: res.millis ?? 0 }))
      } else {
        ElMessage.error(res.message || t('pages.gis.xyzTestFail'))
      }
    } finally {
      testing.value = false
    }
  }
  let bag: LabMapBag | undefined

  const cap = (code: string): string => {
    if (code === 'tianditu') return 'Tianditu'
    if (code === 'amap') return 'Amap'
    if (code === 'baidu') return 'Baidu'
    if (code === 'xyz') return 'Xyz'
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
    void loadXyz()
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
      if (provider === 'xyz') {
        body.extraJson = xyzExtraJson()
      }
      await fetchSaveGisProvider(body)
      draft[provider].apiKey = ''
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
    )
      .then(async () => {
        await fetchRemoveGisProvider([card.id!])
        await load()
      })
      .catch(() => {
        /* cancel */
      })
  }

  onMounted(async () => {
    const status = await fetchGisStatus()
    const provider = rememberedOrFirst(status.providers)
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

  onDeactivated(() => {
    ElMessageBox.close()
  })

  onBeforeRouteLeave(() => {
    ElMessageBox.close()
  })

  onBeforeUnmount(() => {
    ElMessageBox.close()
    bag?.destroy()
    bag = undefined
  })
</script>

<style src="../gis-shell.css"></style>
<style scoped>
  .gis-hud-panel-wide {
    overflow: auto;
  }

  .gis-xyz-hosts {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
    word-break: break-all;
  }

  .gis-panel-lead {
    margin: 0 0 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
  }

  .gis-provider-card {
    padding: 6px;
    margin-bottom: 4px;
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

  .gis-provider-card :deep(.el-form-item) {
    margin-bottom: 8px;
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
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.35;
    color: var(--el-text-color-secondary);
  }
</style>
