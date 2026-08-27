<!-- OAuth2 授权同意页：展示客户端与请求范围，用户批准后换取一次性 code 并回跳 redirect_uri（标准授权码流） -->
<template>
  <div class="oauth-consent">
    <ElCard class="consent-card">
      <template #header>
        <span class="consent-title">{{ $t('pages.system.oauthConsent.title') }}</span>
      </template>
      <div v-if="loading" class="consent-loading">{{
        $t('pages.system.oauthConsent.loading')
      }}</div>
      <template v-else-if="info">
        <p class="consent-line">
          {{ $t('pages.system.oauthConsent.appPrefix') }}
          <b>{{ info.clientName || info.clientId }}</b>
          {{ $t('pages.system.oauthConsent.requestSuffix') }}
        </p>
        <ul class="consent-scopes">
          <li v-for="s in info.scopes" :key="s">
            <ElTag size="small">{{ s }}</ElTag>
          </li>
          <li v-if="!info.scopes || info.scopes.length === 0" class="consent-empty">{{
            $t('pages.system.oauthConsent.noScopes')
          }}</li>
        </ul>
        <div v-if="issuedCode" class="consent-code">
          {{ $t('pages.system.oauthConsent.codeLabel') }}<code>{{ issuedCode }}</code>
        </div>
        <div class="consent-actions">
          <ElButton @click="deny">{{ $t('pages.system.oauthConsent.deny') }}</ElButton>
          <ElButton type="primary" :loading="submitting" @click="approve">{{
            $t('pages.system.oauthConsent.approve')
          }}</ElButton>
        </div>
      </template>
      <div v-else class="consent-error">
        {{ errorMsg || $t('pages.system.oauthConsent.paramError') }}
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { fetchOauthAuthorizeInfo, fetchOauthAuthorizeConfirm } from '@/api/oauth'
  import { useUserStore } from '@/store/modules/user'

  defineOptions({ name: 'OauthConsent' })

  const { t } = useI18n()

  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()

  const loading = ref(true)
  const submitting = ref(false)
  const info = ref<{ clientId: string; clientName: string; scopes: string[] } | null>(null)
  const errorMsg = ref('')
  const issuedCode = ref('')

  const q = () => ({
    clientId: route.query.client_id as string,
    scope: route.query.scope as string,
    redirectUri: route.query.redirect_uri as string,
    state: route.query.state as string,
    codeChallenge: route.query.code_challenge as string,
    codeChallengeMethod: route.query.code_challenge_method as string
  })

  onMounted(async () => {
    if (!userStore.isLogin) {
      // 未登录：跳登录并带回跳
      router.push({ path: '/auth/login', query: { redirect: route.fullPath } })
      return
    }
    const { clientId, scope } = q()
    if (!clientId) {
      errorMsg.value = t('pages.system.oauthConsent.missingClientId')
      loading.value = false
      return
    }
    try {
      info.value = await fetchOauthAuthorizeInfo({ client_id: clientId, scope })
    } catch (e: any) {
      errorMsg.value = e?.message || t('pages.system.oauthConsent.invalidClient')
    } finally {
      loading.value = false
    }
  })

  /** 跳转协议白名单：仅 http(s)（防 javascript: 伪协议经 location.href 在本源执行脚本） */
  const safeRedirect = (uri: string): string | null => (/^https?:\/\//i.test(uri) ? uri : null)

  /** 确认授权时使用客户端登记范围（与 info 展示一致），避免 URL scope 与客户端不匹配导致 invalid_scope */
  const confirmScope = () => {
    const fromInfo = info.value?.scopes?.filter(Boolean) ?? []
    if (fromInfo.length > 0) return fromInfo.join(' ')
    return q().scope || ''
  }

  const approve = async () => {
    submitting.value = true
    try {
      const p = q()
      const resp = await fetchOauthAuthorizeConfirm({ ...p, scope: confirmScope() })
      const redirect = safeRedirect(p.redirectUri || '')
      if (redirect) {
        const sep = redirect.includes('?') ? '&' : '?'
        const statePart = p.state ? `&state=${encodeURIComponent(p.state)}` : ''
        window.location.href = `${redirect}${sep}code=${encodeURIComponent(resp.code)}${statePart}`
      } else {
        issuedCode.value = resp.code
        ElMessage.success(t('pages.system.oauthConsent.msgSuccess'))
      }
    } catch (e: any) {
      ElMessage.error(e?.message || t('pages.system.oauthConsent.msgFailed'))
    } finally {
      submitting.value = false
    }
  }

  const deny = () => {
    const { redirectUri, state } = q()
    const safe = safeRedirect(redirectUri || '')
    if (safe) {
      const sep = safe.includes('?') ? '&' : '?'
      const statePart = state ? `&state=${encodeURIComponent(state)}` : ''
      window.location.href = `${safe}${sep}error=access_denied${statePart}`
    } else {
      router.push('/')
    }
  }
</script>

<style scoped>
  .oauth-consent {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--el-bg-color-page);
  }

  .consent-card {
    width: 420px;
  }

  .consent-title {
    font-weight: 600;
  }

  .consent-scopes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    margin: 12px 0;
    list-style: none;
  }

  .consent-empty {
    color: var(--el-text-color-secondary);
  }

  .consent-code {
    padding: 8px;
    margin: 8px 0;
    word-break: break-all;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .consent-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
  }
</style>
