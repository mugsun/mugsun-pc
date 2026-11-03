/**
 * 一次性口令展示：建租户 / 建用户 / 重置口令 / 导入新建 成功后弹窗，可逐项复制。
 * 口令只出现在本次响应，勿写入日志或本地存储。
 */
import { h } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { $t } from '@/locales'

export interface OneTimeCredentialItem {
  /** 行标签（用户名、租户编号等） */
  label: string
  /** 展示值（口令或编号） */
  value: string
}

export interface ShowOneTimeCredentialsOptions {
  title: string
  /** 顶部提示：仅此一次、须改密等 */
  tip: string
  items: OneTimeCredentialItem[]
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success($t('common.copied'))
  } catch {
    ElMessage.error($t('common.copyFailed'))
  }
}

/** 弹窗展示一次性凭据；关闭前可复制。不关点遮罩，避免运维误关丢口令。 */
export function showOneTimeCredentials(options: ShowOneTimeCredentialsOptions): Promise<void> {
  const { title, tip, items } = options
  const copyLabel = $t('common.copy')
  const confirmLabel = $t('common.confirm')

  return ElMessageBox({
    title,
    message: h('div', { class: 'otp-box' }, [
      h(
        'p',
        {
          class: 'otp-box__tip',
          style: {
            margin: '0 0 12px',
            color: 'var(--el-color-warning)',
            lineHeight: '1.5',
            wordBreak: 'break-word'
          }
        },
        tip
      ),
      h(
        'div',
        {
          class: 'otp-box__list',
          style: { display: 'flex', flexDirection: 'column', gap: '10px' }
        },
        items.map((item) =>
          h(
            'div',
            {
              class: 'otp-box__row',
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--el-fill-color-light)'
              }
            },
            [
              h(
                'span',
                {
                  style: {
                    minWidth: '72px',
                    color: 'var(--el-text-color-secondary)',
                    fontSize: '13px'
                  }
                },
                item.label
              ),
              h(
                'code',
                {
                  style: {
                    flex: '1 1 120px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '14px',
                    wordBreak: 'break-all',
                    userSelect: 'all'
                  }
                },
                item.value
              ),
              h(
                ElButton,
                {
                  size: 'small',
                  type: 'primary',
                  link: true,
                  onClick: () => {
                    void copyText(item.value)
                  }
                },
                () => copyLabel
              )
            ]
          )
        )
      )
    ]),
    confirmButtonText: confirmLabel,
    showCancelButton: false,
    closeOnClickModal: false,
    closeOnPressEscape: false,
    draggable: true
  }).then(() => undefined)
}
