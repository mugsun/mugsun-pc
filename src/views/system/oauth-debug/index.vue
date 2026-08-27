<!-- 开放平台接口调试：换取令牌 → 调用开放接口，直观演示 scope 放行/拒绝 -->
<template>
  <div class="oauth-debug-page art-full-height">
    <ElCard class="art-table-card">
      <!-- 卡片体为定高裁剪（全局 overflow:hidden），长响应内容须自备内部滚动，防矮视口裁切 -->
      <div class="oauth-debug-scroll">
        <ElAlert
          type="info"
          :closable="false"
          :title="$t('pages.system.oauthDebug.alertTip')"
          style="margin-bottom: 16px"
        />

        <ElForm :model="form" label-width="110px" style="max-width: 640px">
          <ElDivider content-position="left">{{ $t('pages.system.oauthDebug.step1') }}</ElDivider>
          <ElFormItem :label="$t('pages.system.oauthDebug.grantType')">
            <ElRadioGroup v-model="form.grantType">
              <ElRadio value="client_credentials">{{
                $t('pages.system.oauthDebug.grantClientCredentials')
              }}</ElRadio>
              <ElRadio value="authorization_code">{{
                $t('pages.system.oauthDebug.grantAuthorizationCode')
              }}</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem label="ClientId">
            <ElInput v-model="form.clientId" placeholder="mc_xxxx" />
          </ElFormItem>
          <ElFormItem label="ClientSecret">
            <ElInput
              v-model="form.clientSecret"
              :placeholder="$t('pages.system.oauthDebug.secretPlaceholder')"
            />
          </ElFormItem>
          <ElFormItem label="scope">
            <ElInput
              v-model="form.scope"
              :placeholder="$t('pages.system.oauthDebug.scopePlaceholder')"
            />
          </ElFormItem>
          <ElFormItem
            v-if="form.grantType === 'authorization_code'"
            :label="$t('pages.system.oauthDebug.codeLabel')"
          >
            <ElInput
              v-model="form.code"
              :placeholder="$t('pages.system.oauthDebug.codePlaceholder')"
            >
              <template #append>
                <ElButton @click="doAuthorize" :loading="authorizing">{{
                  $t('pages.system.oauthDebug.browserAuth')
                }}</ElButton>
              </template>
            </ElInput>
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" @click="doToken" :loading="tokenLoading">{{
              $t('pages.system.oauthDebug.getToken')
            }}</ElButton>
            <span v-if="token" class="oauth-token-tip">{{
              $t('pages.system.oauthDebug.tokenTip')
            }}</span>
          </ElFormItem>
          <ElFormItem v-if="tokenResult" :label="$t('pages.system.oauthDebug.tokenResult')">
            <pre class="oauth-out">{{ tokenResult }}</pre>
          </ElFormItem>

          <ElDivider content-position="left">{{ $t('pages.system.oauthDebug.step2') }}</ElDivider>
          <ElFormItem :label="$t('pages.system.oauthDebug.apiLabel')">
            <ElSelect v-model="apiPath" style="width: 100%">
              <ElOption :label="$t('pages.system.oauthDebug.apiPing')" value="GET /open/ping" />
              <ElOption
                :label="$t('pages.system.oauthDebug.apiUserList')"
                value="GET /open/user/list"
              />
              <ElOption
                :label="$t('pages.system.oauthDebug.apiUserCount')"
                value="GET /open/user/count"
              />
              <ElOption :label="$t('pages.system.oauthDebug.apiEcho')" value="POST /open/echo" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" @click="callApi" :loading="apiLoading" :disabled="!token">{{
              $t('pages.system.oauthDebug.callApi')
            }}</ElButton>
          </ElFormItem>
          <ElFormItem v-if="apiResult" :label="$t('pages.system.oauthDebug.apiResult')">
            <div style="width: 100%">
              <ElTag :type="apiStatus === 200 ? 'success' : 'danger'" style="margin-bottom: 8px">
                HTTP {{ apiStatus }} ·
                {{
                  apiStatus === 200
                    ? $t('pages.system.oauthDebug.passed')
                    : $t('pages.system.oauthDebug.rejected')
                }}
              </ElTag>
              <pre class="oauth-out">{{ apiResult }}</pre>
            </div>
          </ElFormItem>
        </ElForm>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { buildOpenApiSignHeaders } from '@/utils/open-api-sign'

  defineOptions({ name: 'OauthDebug' })

  const { t } = useI18n()

  const route = useRoute()

  const form = reactive({
    grantType: 'client_credentials',
    clientId: '',
    clientSecret: '',
    scope: 'user:read',
    code: ''
  })

  const token = ref('')
  const tokenResult = ref('')
  const tokenLoading = ref(false)
  const authorizing = ref(false)
  const apiPath = ref('GET /open/user/list')
  const apiResult = ref('')
  const apiStatus = ref(0)
  const apiLoading = ref(false)

  const pretty = (o: unknown): string => JSON.stringify(o, null, 2)

  /** 本页 URL 作 redirect_uri，授权后带 code 回跳此页 */
  const selfRedirect = (): string => `${window.location.origin}/#/open-platform/oauth-debug`

  /** 授权后回跳带回 code，自动填入 */
  onMounted(() => {
    const code = route.query.code as string
    if (code) {
      form.grantType = 'authorization_code'
      form.code = code
      ElMessage.success(t('pages.system.oauthDebug.msgCodeFromCallback'))
    }
  })

  /** 跳转标准授权端点 → 同意页 → 回跳本页（浏览器授权码流） */
  const doAuthorize = (): void => {
    if (!form.clientId) {
      ElMessage.warning(t('pages.system.oauthDebug.msgClientIdRequired'))
      return
    }
    authorizing.value = true
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: form.clientId,
      redirect_uri: selfRedirect(),
      scope: form.scope || '',
      state: 'debug'
    })
    window.location.href = `/api/oauth2/authorize?${params.toString()}`
  }

  /** 换取访问令牌（form 入参 + 标准原始 JSON 响应） */
  const doToken = async (): Promise<void> => {
    tokenLoading.value = true
    try {
      const body = new URLSearchParams({
        grant_type: form.grantType,
        client_id: form.clientId,
        client_secret: form.clientSecret,
        scope: form.scope || ''
      })
      if (form.grantType === 'authorization_code') {
        body.set('code', form.code)
        body.set('redirect_uri', selfRedirect())
      }
      const resp = await fetch('/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
      const data = await resp.json()
      tokenResult.value = pretty(data)
      if (resp.status === 200 && data?.access_token) {
        token.value = data.access_token
        ElMessage.success(t('pages.system.oauthDebug.msgTokenSuccess'))
      } else {
        token.value = ''
        ElMessage.error(
          data?.error_description || data?.error || t('pages.system.oauthDebug.msgTokenFailed')
        )
      }
    } catch {
      // 原生 fetch 不走全局 http 拦截，网络错误需就地提示（防静默失败）
      token.value = ''
      ElMessage.error(t('pages.system.oauthDebug.msgTokenNetworkError'))
    } finally {
      tokenLoading.value = false
    }
  }

  /** 用令牌调用开放接口 */
  const callApi = async (): Promise<void> => {
    if (!form.clientSecret) {
      ElMessage.warning(t('pages.system.oauthDebug.secretPlaceholder'))
      return
    }
    apiLoading.value = true
    try {
      const [method, rawPath] = apiPath.value.split(' ')
      const [pathOnly, query = ''] = rawPath.split('?')
      const bodyStr = method === 'POST' ? JSON.stringify({ demo: 'hello' }) : ''
      const signHeaders = buildOpenApiSignHeaders(
        method,
        pathOnly,
        query,
        bodyStr,
        form.clientSecret
      )
      const options: { method: string; headers: Record<string, string>; body?: string } = {
        method,
        headers: {
          Authorization: `Bearer ${token.value}`,
          'Content-Type': 'application/json',
          ...signHeaders
        }
      }
      if (method === 'POST') options.body = bodyStr
      const resp = await fetch(`/api${rawPath}`, options)
      apiStatus.value = resp.status
      const data = await resp.json()
      apiResult.value = pretty(data)
    } catch {
      // 原生 fetch 不走全局 http 拦截，网络错误需就地提示（防静默失败）
      ElMessage.error(t('pages.system.oauthDebug.msgApiNetworkError'))
    } finally {
      apiLoading.value = false
    }
  }
</script>

<style scoped>
  /* 卡片体为定高裁剪（全局 overflow:hidden），内容须自备内部滚动，防矮视口裁切 */
  .oauth-debug-scroll {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
  }

  .oauth-token-tip {
    margin-left: 12px;
    color: var(--el-color-success);
  }

  .oauth-out {
    width: 100%;
    padding: 10px 12px;
    margin: 0;
    font-size: 12px;
    word-break: break-all;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }
</style>
