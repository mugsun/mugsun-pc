<!-- 工作台「更新日志」卡：当前版本（package.json）+ 后台最近更新（/system/changelog/recent），含加载/空/错误态 -->
<template>
  <div class="art-card list-card changelog-card" data-test="changelog-card">
    <div class="card-head">
      <span class="card-title">{{ $t('pages.dashboard.console.changelog') }}</span>
      <ElLink
        type="primary"
        :href="CHANGELOG_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="changelog-link"
        data-test="changelog-link"
        :aria-label="$t('pages.dashboard.console.viewChangelogAria')"
      >
        {{ $t('pages.dashboard.console.viewChangelog')
        }}<span class="changelog-link__icon" aria-hidden="true">↗</span>
      </ElLink>
    </div>

    <!-- 当前版本：来自构建时的 package.json，不依赖接口，加载失败时也照常显示 -->
    <div class="changelog-version" data-test="changelog-version">
      <span class="changelog-version__label">{{
        $t('pages.dashboard.console.currentVersion')
      }}</span>
      <span class="changelog-version__value">v{{ appVersion }}</span>
      <span v-if="availableVersion" class="changelog-version__update" data-test="changelog-update">
        {{ $t('pages.dashboard.console.changelogUpdateAvailable', { version: availableVersion }) }}
      </span>
    </div>

    <div class="changelog-body" :aria-busy="loading">
      <ElSkeleton v-if="loading" :rows="4" animated data-test="changelog-loading" />
      <!-- 加载失败：卡片内错误态 + 重试；不弹全局 toast，后端原文只进 console -->
      <div v-else-if="loadError" class="changelog-error" data-test="changelog-error">
        <ElIcon class="changelog-error__icon"><CircleCloseFilled /></ElIcon>
        <p class="changelog-error__text" data-test="changelog-error-text">
          {{ loadErrorLead
          }}<span class="changelog-error__id" data-test="changelog-error-id">{{
            loadErrorIdPart
          }}</span>
        </p>
        <ElButton size="small" :loading="loading" data-test="changelog-retry" @click="reload">
          {{ $t('pages.dashboard.console.changelogRetry') }}
        </ElButton>
      </div>
      <ElEmpty
        v-else-if="!entries.length"
        :description="$t('pages.dashboard.console.noChangelog')"
        :image-size="60"
        data-test="changelog-empty"
      />
      <ElTimeline v-else class="changelog-timeline" data-test="changelog-list">
        <ElTimelineItem
          v-for="item in entries"
          :key="item.id"
          :timestamp="item.date"
          :type="TYPE_META[item.type].dot"
          placement="top"
        >
          <div class="changelog-item__head">
            <ElTag size="small" :type="TYPE_META[item.type].tag" disable-transitions>
              {{ $t(TYPE_META[item.type].label) }}
            </ElTag>
            <span v-if="item.version" class="changelog-item__version">{{ item.version }}</span>
            <ElTag
              v-if="item.notInstalled"
              size="small"
              type="info"
              effect="plain"
              disable-transitions
              data-test="changelog-not-installed"
            >
              {{ $t('pages.dashboard.console.changelogNotInstalled') }}
            </ElTag>
          </div>
          <div class="changelog-item__title">{{ item.title }}</div>
        </ElTimelineItem>
      </ElTimeline>
    </div>

    <!-- 读屏：错误出现时 polite 读一次（不用 role=alert） -->
    <div class="visually-hidden" aria-live="polite" data-test="changelog-live">{{ liveText }}</div>
  </div>
</template>

<script setup lang="ts">
  import { CircleCloseFilled } from '@element-plus/icons-vue'
  import { useI18n } from 'vue-i18n'
  import { fetchChangelogRecent } from '@/api/feedback'
  import { useChangelogRecent, type ChangelogType } from './useChangelogRecent'

  defineOptions({ name: 'ConsoleChangelogCard' })

  const { t } = useI18n()

  const appVersion = __PKG_VERSION__
  const CHANGELOG_URL = 'https://github.com/mugsun/mugsun-pc/blob/main/CHANGELOG.md'

  type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'
  const TYPE_META: Record<ChangelogType, { label: string; tag: TagType; dot: TagType }> = {
    feature: {
      label: 'pages.dashboard.console.changelogTypeFeature',
      tag: 'primary',
      dot: 'primary'
    },
    optimize: {
      label: 'pages.dashboard.console.changelogTypeOptimize',
      tag: 'warning',
      dot: 'warning'
    },
    fix: { label: 'pages.dashboard.console.changelogTypeFix', tag: 'danger', dot: 'danger' },
    other: { label: 'pages.dashboard.console.changelogTypeOther', tag: 'info', dot: 'info' }
  }

  const {
    entries,
    availableVersion,
    loading,
    loadError,
    loadErrorLead,
    loadErrorIdPart,
    liveText,
    reload,
    invalidate
  } = useChangelogRecent({
    fetchRecent: fetchChangelogRecent,
    t,
    limit: 6,
    currentVersion: appVersion
  })

  onMounted(reload)
  onUnmounted(invalidate)
</script>

<style lang="scss" scoped>
  .changelog-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* 工作台 index.vue 的 .card-head/.card-title 是 scoped 样式，进不到子组件内部，这里按同款写一份 */
  .card-head {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .card-title {
    min-width: 0;
    font-size: 16px;
    font-weight: 500;
  }

  .changelog-link {
    flex-shrink: 0;
    font-size: 13px;
  }

  .changelog-link__icon {
    margin-left: 2px;
  }

  /* ElLink 默认 outline:none，键盘聚焦时看不出焦点，这里补一圈主色描边 */
  .changelog-link:focus-visible {
    border-radius: 2px;
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  .changelog-version {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: baseline;
    padding: 10px 12px;
    margin-bottom: 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;

    &__label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    &__value {
      font-size: 18px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      overflow-wrap: anywhere;
    }

    /* 「有新版本 vX」靠右小字；窄屏放不下时整段换到下一行 */
    &__update {
      margin-left: auto;
      font-size: 12px;
      color: var(--el-color-warning);
      white-space: nowrap;
    }
  }

  .changelog-body {
    flex: 1;
    min-width: 0;
  }

  .changelog-timeline {
    padding-left: 2px;
    margin: 0;

    :deep(.el-timeline-item) {
      padding-bottom: 14px;
    }

    :deep(.el-timeline-item:last-child) {
      padding-bottom: 0;
    }
  }

  .changelog-item__head {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .changelog-item__version {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    overflow-wrap: anywhere;
  }

  .changelog-item__title {
    margin-top: 4px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--el-text-color-primary);
    overflow-wrap: anywhere;
  }

  .changelog-error {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    padding: 24px 8px;
    text-align: center;

    &__icon {
      font-size: 40px;
      color: var(--el-color-danger);
    }

    &__text {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--el-text-color-secondary);
    }
  }

  /*
   * 编号段是一个 inline-block：在父行里不可拆，放不下就整段换到下一行；
   * 宽度按内容收缩（最多 100%）。390 宽时卡片内容区约 320px，32 位编号整段放不进一行时
   * 才在段内折行（overflow-wrap 兜底），不横向溢出。
   */
  .changelog-error__id {
    display: inline-block;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
