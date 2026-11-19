<!-- 第三方登录回调页：只处理本标签页发起的那次授权（登录页 / 个人中心跳转前记下的 state），按发起时的用途登录或绑定（绑定先确认）；
     别人发来的回调链接不发任何请求。openId 由服务端换取，前端不接触 -->
<template>
  <div class="social-callback">
    <ElResult :icon="icon" :title="title" :sub-title="subTitle">
      <template v-if="ignored" #extra>
        <ElButton type="primary" @click="leave">{{
          $t('pages.auth.socialCallback.leave')
        }}</ElButton>
      </template>
    </ElResult>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { fetchSocialLogin, fetchSocialBind } from '@/api/auth'
  import { useUserStore } from '@/store/modules/user'
  import { takeSocialFlow } from '@/utils/security/socialFlow'

  defineOptions({ name: 'SocialCallback' })

  const { t } = useI18n()

  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()

  const icon = ref<'info' | 'success' | 'warning' | 'error'>('info')
  const title = ref(t('pages.auth.socialCallback.processing'))
  const subTitle = ref('')
  const ignored = ref(false)

  const leave = () => router.push(userStore.isLogin ? '/system/user-center' : '/auth/login')

  onMounted(async () => {
    const source = route.query.source as string
    const code = route.query.code as string
    const state = route.query.state as string
    if (!source || !code || !state) {
      icon.value = 'error'
      title.value = t('pages.auth.socialCallback.missingParams')
      subTitle.value = t('pages.auth.socialCallback.redirecting')
      setTimeout(leave, 1500)
      return
    }
    const purpose = takeSocialFlow(source, state)
    if (!purpose) {
      icon.value = 'warning'
      title.value = t('pages.auth.socialCallback.notInitiated')
      subTitle.value = t('pages.auth.socialCallback.notInitiatedDetail')
      ignored.value = true
      return
    }
    try {
      if (purpose === 'bind') {
        if (!userStore.isLogin) {
          throw new Error(t('pages.auth.socialCallback.bindNeedLogin'))
        }
        const confirmed = await ElMessageBox.confirm(
          t('pages.auth.socialCallback.confirmBind', { source }),
          t('pages.auth.socialCallback.confirmBindTitle'),
          { type: 'warning' }
        ).then(
          () => true,
          () => false
        )
        if (!confirmed) {
          title.value = t('pages.auth.socialCallback.bindCancelled')
          subTitle.value = t('pages.auth.socialCallback.redirecting')
          setTimeout(leave, 1500)
          return
        }
        await fetchSocialBind({ source, code, state })
        icon.value = 'success'
        title.value = t('pages.auth.socialCallback.bindSuccess')
        ElMessage.success(t('pages.auth.socialCallback.bindSuccessMessage'))
        setTimeout(() => router.push('/system/user-center'), 800)
      } else {
        const resp = await fetchSocialLogin({ source, code, state })
        userStore.setToken(resp.token, resp.refreshToken)
        userStore.setLoginStatus(true)
        icon.value = 'success'
        title.value = t('login.success.title')
        ElMessage.success(t('pages.auth.socialCallback.loginSuccessMessage'))
        setTimeout(() => router.push('/'), 600)
      }
    } catch (e: any) {
      icon.value = 'error'
      title.value = t('pages.auth.socialCallback.failed')
      subTitle.value = e?.message || t('pages.auth.socialCallback.retry')
      setTimeout(leave, 1500)
    }
  })
</script>

<style scoped>
  .social-callback {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }
</style>
