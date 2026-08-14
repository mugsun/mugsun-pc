<!-- 全局在线帮助抽屉：右缘悬浮触发，按当前路由展示关联帮助文档 -->
<template>
  <div class="help-drawer">
    <!-- 右缘悬浮触发按钮 -->
    <button class="help-trigger" :title="$t('components.helpDrawer.title')" @click="openDrawer">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path
          d="M12 2a10 10 0 100 20 10 10 0 000-20zm.02 15.5a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm1.7-6.06c-.7.53-.86.78-.86 1.31v.5h-1.7v-.6c0-1.1.42-1.68 1.28-2.32.62-.47.86-.77.86-1.28 0-.6-.47-1.02-1.2-1.02-.7 0-1.2.4-1.36 1.1l-1.62-.4c.3-1.34 1.4-2.24 3-2.24 1.76 0 2.98 1 2.98 2.5 0 1.03-.5 1.68-1.36 2.35z"
        />
      </svg>
      <span class="help-trigger-text">{{ $t('components.helpDrawer.triggerText') }}</span>
    </button>

    <ElDrawer
      v-model="visible"
      :title="$t('components.helpDrawer.title')"
      size="420px"
      :append-to-body="true"
      @open="loadDocs"
    >
      <!-- 详情视图 -->
      <div v-if="current" class="help-detail">
        <ElButton link type="primary" class="help-back" @click="current = null">
          <ArtSvgIcon icon="ri:arrow-left-line" /> {{ $t('components.helpDrawer.backToList') }}
        </ElButton>
        <h3 class="help-detail-title">{{ current.title }}</h3>
        <div class="help-detail-meta">
          {{ $t('components.helpDrawer.viewsLabel') }} {{ current.viewCount ?? 0 }}
        </div>
        <div class="help-detail-content" v-safe-html="current?.content"></div>
      </div>

      <!-- 列表视图 -->
      <div v-else v-loading="loading" class="help-list">
        <ElEmpty
          v-if="!docs.length && !loading"
          :description="$t('components.helpDrawer.emptyText')"
        />
        <ul v-else class="help-items">
          <li v-for="doc in docs" :key="doc.id" class="help-item" @click="openDoc(doc)">
            <span class="help-item-title">{{ doc.title }}</span>
            <span class="help-item-views"
              >{{ doc.viewCount ?? 0 }} {{ $t('components.helpDrawer.viewTimes') }}</span
            >
          </li>
        </ul>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { fetchHelpPageDocs, fetchViewHelpDoc } from '@/api/help-doc'

  defineOptions({ name: 'ArtHelpDrawer' })

  const route = useRoute()
  const visible = ref(false)
  const loading = ref(false)
  const docs = ref<any[]>([])
  const current = ref<any>(null)

  // 富文本渲染统一走 v-safe-html 指令（DOMPurify 净化），防存储型 XSS

  const openDrawer = () => {
    current.value = null
    visible.value = true
  }

  // 按当前路由拉取关联文档
  const loadDocs = async () => {
    loading.value = true
    try {
      docs.value = (await fetchHelpPageDocs(route.path)) || []
    } finally {
      loading.value = false
    }
  }

  // 查看文档详情：浏览量 +1 并载入内容
  const openDoc = async (doc: any) => {
    current.value = await fetchViewHelpDoc(doc.id)
  }

  // 抽屉开启时切换路由，跟随当前页刷新关联文档
  watch(
    () => route.path,
    () => {
      if (visible.value) {
        current.value = null
        loadDocs()
      }
    }
  )
</script>

<style lang="scss" scoped>
  .help-trigger {
    position: fixed;

    /* 贴右下而非垂直居中，避免挡住表格右固定列与横向滚动条 */
    right: 0;
    bottom: 96px;
    z-index: 999;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
    padding: 10px 6px;
    color: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border: none;
    border-radius: 8px 0 0 8px;
    box-shadow: 0 2px 12px rgb(0 0 0 / 15%);
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.88;
    }

    .help-trigger-text {
      font-size: 12px;
      letter-spacing: 2px;
      writing-mode: vertical-lr;
    }
  }

  .help-items {
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .help-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    cursor: pointer;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;

    & + & {
      margin-top: 10px;
    }

    &:hover {
      border-color: var(--el-color-primary);
    }

    .help-item-title {
      font-weight: 500;
    }

    .help-item-views {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .help-back {
    padding: 0;
  }

  .help-detail-title {
    margin: 12px 0 4px;
  }

  .help-detail-meta {
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .help-detail-content {
    line-height: 1.7;

    :deep(img) {
      max-width: 100%;
    }
  }
</style>
