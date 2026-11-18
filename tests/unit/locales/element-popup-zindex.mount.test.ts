import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import ElementPlus, { ElConfigProvider, ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import { ELEMENT_Z_INDEX, bindElementLocale } from '@/locales/element'

/**
 * 对话框打开时弹出的组件树外弹层（Message / MessageBox）必须叠在对话框上面，
 * 否则提交失败的提示、二次确认框都被对话框盖住，看起来像「点了没反应」。
 * 主应用没有全量注册 Element Plus（弹层读模块级全局配置），AI 抽屉的独立 app 注册了（弹层读 app 级 provide），
 * 两条路径都要覆盖；全量注册会改写 ElMessage._context，所以未注册的用例必须排在前面。
 */
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ language: 'zh' }) }))

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

const zIndexOf = (selector: string) => {
  const el = document.querySelector<HTMLElement>(selector)
  expect(el, selector).not.toBeNull()
  return Number(el!.style.zIndex)
}

let app: App | null = null

async function openDialog(installElementPlus: boolean) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({
    render: () =>
      h(ElConfigProvider, { zIndex: ELEMENT_Z_INDEX }, () =>
        h(ElDialog, { modelValue: true, title: '新增用户' }, () => '表单')
      )
  })
  if (installElementPlus) app.use(ElementPlus)
  bindElementLocale(app)
  app.mount(host)
  await flush()
}

afterEach(() => {
  ElMessage.closeAll()
  ElMessageBox.close()
  app?.unmount()
  app = null
  document.body.innerHTML = ''
})

describe('组件树外的 Element Plus 弹层叠在对话框上面', () => {
  it.each([
    ['主应用（未全量注册 Element Plus）', false],
    ['全量注册了 Element Plus 的独立 app（AI 抽屉）', true]
  ])('%s：错误提示和确认框都在对话框之上', async (_name, installElementPlus) => {
    await openDialog(installElementPlus)
    const dialog = zIndexOf('.el-modal-dialog')
    expect(dialog).toBeGreaterThanOrEqual(ELEMENT_Z_INDEX)

    ElMessage.error('角色的菜单权限超出了你自己的权限')
    void ElMessageBox.confirm('确定要移除吗？').catch(() => undefined)
    await flush()

    expect(zIndexOf('.el-message')).toBeGreaterThan(dialog)
    expect(zIndexOf('.el-overlay.is-message-box')).toBeGreaterThan(dialog)
  })
})
