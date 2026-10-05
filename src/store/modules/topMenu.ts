import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchMyTopMenus, type TopMenuScheme } from '@/api/top-menu'

const ACTIVE_KEY = 'mugsun-top-menu-active'

/**
 * 当前用户的顶部菜单方案。没有方案时不改变原有菜单。
 */
export const useTopMenuStore = defineStore('topMenuScheme', () => {
  const schemes = ref<TopMenuScheme[]>([])
  const activeId = ref(sessionStorage.getItem(ACTIVE_KEY) || '')

  const active = computed(() => {
    if (!schemes.value.length) return null
    return (
      schemes.value.find((item) => item.id === activeId.value) ||
      schemes.value.find((item) => item.home) ||
      schemes.value[0]
    )
  })

  const load = async () => {
    try {
      schemes.value = (await fetchMyTopMenus()) || []
    } catch {
      schemes.value = []
    }
    if (active.value && active.value.id !== activeId.value) {
      activeId.value = active.value.id
      sessionStorage.setItem(ACTIVE_KEY, activeId.value)
    }
    if (!schemes.value.length) {
      activeId.value = ''
      sessionStorage.removeItem(ACTIVE_KEY)
    }
  }

  const select = (id: string) => {
    activeId.value = id
    sessionStorage.setItem(ACTIVE_KEY, id)
  }

  const reset = () => {
    schemes.value = []
    activeId.value = ''
    sessionStorage.removeItem(ACTIVE_KEY)
  }

  return { schemes, activeId, active, load, select, reset }
})
