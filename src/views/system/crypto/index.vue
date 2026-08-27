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
      <ElInput
        v-model="inputText"
        type="textarea"
        :rows="3"
        :placeholder="$t('pages.system.crypto.inputPlaceholder')"
      />
      <ElButton type="primary" class="mt-3" :loading="loading" @click="handleSend">
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

  defineOptions({ name: 'CryptoDemo' })

  const { t } = useI18n()

  // 与后端 mugsun.crypto.api-key 一致（开发环境见 .env.development VITE_CRYPTO_API_KEY）
  const apiKeyStr = import.meta.env.VITE_CRYPTO_API_KEY || 'mugsun-api-key16'
  const apiKey = Array.from(new TextEncoder().encode(apiKeyStr))

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
  const encryptCbc = (plain: string): string => {
    const iv = crypto.getRandomValues(new Uint8Array(16))
    const ivHex = toHex(iv)
    const cipher = sm4.encrypt(plain, apiKey, { mode: 'cbc', iv: ivHex })
    return ivHex + cipher
  }
  // SM4-CBC 解密：拆前 32 hex 为 IV，其余为密文
  const decryptCbc = (data: string): string => {
    const ivHex = data.slice(0, 32)
    const cipher = data.slice(32)
    return sm4.decrypt(cipher, apiKey, { mode: 'cbc', iv: ivHex })
  }

  const handleSend = async () => {
    if (!inputText.value) {
      ElMessage.warning(t('pages.system.crypto.inputRequired'))
      return
    }
    loading.value = true
    try {
      const plainJson = JSON.stringify({ text: inputText.value })
      const encryptData = encryptCbc(plainJson)
      requestCipher.value = encryptData
      responseCipher.value = ''
      decrypted.value = ''

      // 走统一请求层（自动携带登录令牌），skipEnvelope 取回原始信封以读 dataType
      const json = await request.post<{ dataType?: string; data?: string }>({
        url: '/api/system/crypto/echo',
        data: { encryptData },
        skipEnvelope: true
      })
      if (json.dataType === 'ENCRYPT') {
        responseCipher.value = json.data || ''
        const plain = decryptCbc(json.data || '')
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
    } catch (e) {
      // 网络/服务端错误已由请求层统一弹提示，这里仅兜底本地加解密异常，避免双重 toast
      if (!isHttpError(e)) ElMessage.error(t('pages.system.crypto.cryptoFailed'))
      console.error('[CryptoDemo]', e)
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped lang="scss">
  .crypto-demo {
    padding: 16px;

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
