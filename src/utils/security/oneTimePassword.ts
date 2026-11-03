/**
 * 一次性口令展示：建租户 / 建用户 / 重置口令 / 导入新建 成功后弹窗，可逐项复制。
 * 口令只出现在本次响应，勿写入日志或本地存储。
 * 未复制前关窗（X / Esc / 遮罩）二次确认，避免运维误关丢口令。
 */
import { defineComponent, h, ref, type PropType } from 'vue'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { $t } from '@/locales'

export interface OneTimeCredentialItem {
  /** 行标签（账号、租户编号、一次性口令等） */
  label: string
  /** 展示值 */
  value: string
}

export interface ShowOneTimeCredentialsOptions {
  title: string
  /** 顶部提示：仅此一次、须改密等 */
  tip: string
  items: OneTimeCredentialItem[]
}

/** 警告字色：浅底上 ≥4.5:1，不用 Element 默认 #e6a23c */
const TIP_COLOR = '#b45309'
const COPIED_HOLD_MS = 1500

const OtpPanel = defineComponent({
  name: 'OneTimePasswordPanel',
  props: {
    tip: { type: String, required: true },
    items: {
      type: Array as PropType<OneTimeCredentialItem[]>,
      required: true
    }
  },
  emits: {
    copied: () => true
  },
  setup(props, { emit }) {
    const btnLabels = ref(props.items.map(() => $t('common.copy')))

    const copyOne = async (index: number, value: string): Promise<void> => {
      try {
        await navigator.clipboard.writeText(value)
        emit('copied')
        const next = [...btnLabels.value]
        next[index] = $t('common.copied')
        btnLabels.value = next
        window.setTimeout(() => {
          const reset = [...btnLabels.value]
          if (reset[index] === $t('common.copied')) {
            reset[index] = $t('common.copy')
            btnLabels.value = reset
          }
        }, COPIED_HOLD_MS)
      } catch {
        ElMessage.error($t('common.copyFailed'))
      }
    }

    return () =>
      h('div', { class: 'otp-box' }, [
        h(
          'p',
          {
            class: 'otp-box__tip',
            style: {
              margin: '0 0 12px',
              color: TIP_COLOR,
              lineHeight: '1.5',
              wordBreak: 'break-word'
            }
          },
          props.tip
        ),
        h(
          'div',
          {
            class: 'otp-box__list',
            style: { display: 'flex', flexDirection: 'column', gap: '10px' }
          },
          props.items.map((item, index) =>
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
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
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
                      void copyOne(index, item.value)
                    }
                  },
                  () => btnLabels.value[index]
                )
              ]
            )
          )
        )
      ])
  }
})

/**
 * 弹窗展示一次性凭据。
 * 未点过「复制」前：X / Esc / 遮罩 → 二次确认；复制成功过一次后可直接关。
 */
export function showOneTimeCredentials(options: ShowOneTimeCredentialsOptions): Promise<void> {
  const { title, tip, items } = options
  let copiedOnce = false

  return ElMessageBox({
    title,
    message: () =>
      h(OtpPanel, {
        tip,
        items,
        onCopied: () => {
          copiedOnce = true
        }
      }),
    confirmButtonText: $t('common.confirm'),
    showCancelButton: false,
    showClose: true,
    closeOnClickModal: true,
    closeOnPressEscape: true,
    distinguishCancelAndClose: true,
    draggable: true,
    beforeClose: (action, _instance, done) => {
      if (action === 'confirm') {
        done()
        return
      }
      // X / Esc / 遮罩
      if (copiedOnce) {
        done()
        return
      }
      // ElMessageBoxOptions 类型不含 zIndex；无遮罩 + 运行时抬 overlay，叠在主 OTP 上同屏可见
      void ElMessageBox.confirm(
        $t('pages.system.otp.closeConfirm'),
        $t('pages.system.otp.closeTitle'),
        {
          confirmButtonText: $t('pages.system.otp.keepViewing'),
          cancelButtonText: $t('pages.system.otp.stillClose'),
          type: 'warning',
          distinguishCancelAndClose: true,
          closeOnClickModal: false,
          closeOnPressEscape: true,
          modal: false,
          customClass: 'otp-close-confirm-box',
          confirmButtonClass: '',
          cancelButtonClass: 'el-button--danger'
        }
      )
        .then(() => {
          // 继续查看：不关主弹窗
        })
        .catch((reason: string) => {
          // 仍要关闭（cancel）；点二次确认的 X/Esc（close）则继续查看
          if (reason === 'cancel') {
            done()
          }
        })
      window.setTimeout(() => {
        document.querySelectorAll('.otp-close-confirm-box').forEach((box) => {
          const overlay = box.closest('.el-overlay') as HTMLElement | null
          if (overlay) overlay.style.zIndex = '10000'
        })
      }, 0)
    }
  }).then(() => undefined)
}
