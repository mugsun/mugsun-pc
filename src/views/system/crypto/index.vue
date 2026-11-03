<!-- 接口国密加解密演示：请求 SM4 加密、响应 SM4 解密（与后端 @ApiDecrypt/@ApiEncrypt 对接） -->
<template>
  <div class="crypto-demo">
    <ElCard shadow="never">
      <template #header>
        <span>{{ $t('pages.system.crypto.cardTitle') }}</span>
      </template>
      <ElAlert
        type="info"
        :closable="false"
        :title="$t('pages.system.crypto.alertText')"
        class="mb-4"
      />
      <div
        v-if="keyErrorKey"
        :id="KEY_ERROR_ID"
        class="key-error"
        aria-live="polite"
        data-testid="crypto-key-error"
      >
        <ElAlert
          v-if="keyErrorShown"
          type="error"
          role="none"
          :closable="false"
          show-icon
          :title="$t('pages.system.crypto.keyErrorTitle')"
        >
          <i18n-t :keypath="keyErrorKey" tag="span">
            <template #envKey><code>VITE_CRYPTO_API_KEY</code></template>
          </i18n-t>
        </ElAlert>
      </div>
      <ElInput
        v-model="inputText"
        type="textarea"
        :rows="3"
        :placeholder="$t('pages.system.crypto.inputPlaceholder')"
      />
      <ElButton
        type="primary"
        class="mt-3"
        :loading="loading"
        :disabled="!!keyErrorKey || !keyReady"
        :aria-describedby="keyErrorKey ? KEY_ERROR_ID : undefined"
        @click="handleSend"
      >
        {{ $t('pages.system.crypto.sendBtn') }}
      </ElButton>

      <div v-if="requestCipher" class="result mt-4">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem :label="$t('pages.system.crypto.labelPlain')">{{
            inputText
          }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.crypto.labelRequestCipher')">
            <span class="cipher">{{ requestCipher }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.crypto.labelResponseCipher')">
            <span class="cipher">{{ responseCipher }}</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.crypto.labelDecrypted')">
            <span class="plain">{{ decrypted }}</span>
          </ElDescriptionsItem>
        </ElDescriptions>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { sm4 } from 'sm-crypto'
  import { ElMessage } from 'element-plus'
  import request from '@/utils/http'
  import { isHttpError } from '@/utils/http/error'
  import { useI18n } from 'vue-i18n'
  import { useUserStore } from '@/store/modules/user'
  import {
    ensureTransportKey,
    getTransportKeyBytes,
    isTransportEncryptionEnabled,
    refreshTransportKeyOnce
  } from '@/utils/crypto/transportKey'

  defineOptions({ name: 'CryptoDemo' })

  const { t } = useI18n()
  const userStore = useUserStore()

  const KEY_ERROR_ID = 'crypto-key-error'
  const keyErrorKey = ref('')
  const keyErrorShown = ref(false)
  const keyReady = ref(false)

  const inputText = ref(t('pages.system.crypto.defaultText'))
  const requestCipher = ref('')
  const responseCipher = ref('')
  const decrypted = ref('')
  const loading = ref(false)

  const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

  // SM4-CBC 加密：随机 16 字节 IV，输出 Hex(IV)‖Hex(密文)，与后端 ApiCryptoService 跨库互通
  const encryptCbc = (plain: string, apiKey: number[]): string => {
    const iv = crypto.getRandomValues(new Uint8Array(16))
    const ivHex = toHex(iv)
    const cipher = sm4.encrypt(plain, apiKey, { mode: 'cbc', iv: ivHex })
    return ivHex + cipher
  }
  // SM4-CBC 解密：拆前 32 hex 为 IV，其余为密文
  const decryptCbc = (data: string, apiKey: number[]): string => {
    const ivHex = data.slice(0, 32)
    const cipher = data.slice(32)
    return sm4.decrypt(cipher, apiKey, { mode: 'cbc', iv: ivHex })
  }

  const syncKeyState = async () => {
    keyErrorKey.value = ''
    keyReady.value = false
    const ok = await ensureTransportKey(!!userStore.isLogin, { silent: true })
    if (!ok || !isTransportEncryptionEnabled()) {
      keyErrorKey.value = 'pages.system.crypto.keyRuntimeUnavailable'
      keyErrorShown.value = true
      return
    }
    keyReady.value = true
  }

  onMounted(() => {
    void syncKeyState()
  })

  const sendOnce = async (apiKey: number[]) => {
    const plainJson = JSON.stringify({ text: inputText.value })
    const encryptData = encryptCbc(plainJson, apiKey)
    requestCipher.value = encryptData
    responseCipher.value = ''
    decrypted.value = ''

    const json = await request.post<{ dataType?: string; data?: string }>({
      url: '/api/system/crypto/echo',
      data: { encryptData },
      skipEnvelope: true
    })
    if (json.dataType === 'ENCRYPT') {
      responseCipher.value = json.data || ''
      const plain = decryptCbc(json.data || '', apiKey)
      try {
        decrypted.value = JSON.stringify(JSON.parse(plain), null, 2)
      } catch {
        decrypted.value = plain
      }
    } else {
      decrypted.value =
        json.data != null
          ? JSON.stringify(json.data, null, 2)
          : t('pages.system.crypto.noEncryptData')
    }
  }

  const isCipherInvalid = (e: unknown): boolean => {
    if (!isHttpError(e)) return false
    const msg = String((e as { message?: string }).message || '')
    return msg.includes('接口密文无效') || /invalid\s*cipher|ciphertext/i.test(msg)
  }

  const handleSend = async () => {
    if (!inputText.value) {
      ElMessage.warning(t('pages.system.crypto.inputRequired'))
      return
    }
    loading.value = true
    try {
      if (!isTransportEncryptionEnabled()) {
        await syncKeyState()
      }
      const bytes = getTransportKeyBytes()
      if (!bytes) return
      try {
        await sendOnce(bytes)
      } catch (e) {
        if (isCipherInvalid(e)) {
          const refreshed = await refreshTransportKeyOnce(!!userStore.isLogin)
          const again = getTransportKeyBytes()
          if (refreshed && again) {
            await sendOnce(again)
            return
          }
        }
        throw e
      }
    } catch (e) {
      // 网络/服务端错误已由请求层统一弹提示，这里仅兜底本地加解密异常，避免双重 toast
      if (!isHttpError(e)) ElMessage.error(t('pages.system.crypto.cryptoFailed'))
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped lang="scss">
  .crypto-demo {
    padding: 16px;

    .key-error {
      margin: 12px 0;

      code {
        font-family: var(--el-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
        font-size: 0.95em;
        white-space: nowrap;
      }
    }

    .cipher {
      font-family: monospace;
      color: var(--el-color-danger);
      word-break: break-all;
    }

    .plain {
      font-weight: 500;
      color: var(--el-color-success);
    }
  }
</style>
