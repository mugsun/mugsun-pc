<!-- 回放入口按钮（错误详情等行内嵌用）：先探测 /replay/detail，该会话确有回放块才渲染；
     探测静默失败（无回放/无权限/接口异常一律不渲染按钮，不打扰主流程） -->
<template>
  <ElButton v-if="available" link type="primary" size="small" @click="onOpen">{{
    $t('pages.track.shared.replay')
  }}</ElButton>
</template>

<script setup lang="ts">
  import { fetchTrackReplayDetail } from '@/api/track'
  import { ElButton } from 'element-plus'

  interface Props {
    sessionId?: string
  }

  interface Emits {
    (e: 'open', sessionId: string): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  /** 该会话是否存在可播放回放（lastSeq >= 0 = 至少一块已落储） */
  const available = ref(false)

  const onOpen = (): void => {
    if (props.sessionId) emit('open', props.sessionId)
  }

  onMounted(async () => {
    if (!props.sessionId) return
    try {
      const detail: any = await fetchTrackReplayDetail({ sessionId: props.sessionId })
      available.value = (detail?.replay?.lastSeq ?? -1) >= 0
    } catch {
      available.value = false
    }
  })
</script>
