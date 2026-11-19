import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'

/**
 * 真实挂载角色菜单授权弹窗，只 mock 菜单树、角色菜单和授权三个接口。
 * 回显必须等于角色实际拥有的菜单：角色的 id 里有目录时，不能把目录下整棵子树勾上，原样保存不能多出任何 id。
 * 用户点击勾选时仍然父子联动。
 */
const fetchMenuTree = vi.fn()
const fetchRoleMenuIds = vi.fn()
const grantRole = vi.fn()
vi.mock('@/api/system-manage', () => ({
  fetchMenuTree: (...a: unknown[]) => fetchMenuTree(...a)
}))
vi.mock('@/api/role', () => ({
  fetchRoleMenuIds: (...a: unknown[]) => fetchRoleMenuIds(...a),
  grantRole: (...a: unknown[]) => grantRole(...a)
}))

import RolePermissionDialog from '@/views/system/role/modules/role-permission-dialog.vue'

const TREE = [
  {
    id: '1',
    menuName: '系统管理',
    children: [
      {
        id: '11',
        menuName: '用户管理',
        children: [
          { id: '111', menuName: '新增用户' },
          { id: '112', menuName: '删除用户' },
          { id: '113', menuName: '查看身份证' }
        ]
      },
      { id: '12', menuName: '角色管理' },
      { id: '13', menuName: '部门管理' }
    ]
  },
  { id: '2', menuName: '工作台' }
]

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

let app: App | null = null
const visible = ref(false)

async function open(roleMenuIds: string[]) {
  fetchMenuTree.mockResolvedValue(JSON.parse(JSON.stringify(TREE)))
  fetchRoleMenuIds.mockResolvedValue(roleMenuIds)
  grantRole.mockResolvedValue(undefined)
  const host = document.createElement('div')
  document.body.appendChild(host)
  visible.value = false
  const i18n = createI18n({ legacy: false, locale: 'zh', messages: { zh, en } })
  app = createApp({
    render: () =>
      h(RolePermissionDialog, {
        visible: visible.value,
        'onUpdate:visible': (v: boolean) => (visible.value = v),
        roleData: { id: 'r1' }
      })
  })
  app.use(ElementPlus).use(i18n)
  app.mount(host)
  visible.value = true
  await flush()
}

const labelOf = (node: Element) =>
  node.firstElementChild?.querySelector('.el-tree-node__label')?.textContent?.trim()
const nodeByLabel = (label: string) =>
  [...document.body.querySelectorAll('.el-tree-node')].find((n) => labelOf(n) === label)!
const checkedLabels = () =>
  [...document.body.querySelectorAll('.el-tree-node.is-checked')].map(labelOf).sort()
const clickCheckbox = async (label: string) => {
  const box = nodeByLabel(label).firstElementChild!.querySelector('input.el-checkbox__original')
  ;(box as HTMLInputElement).click()
  await flush()
}
const save = async () => {
  ;([...document.body.querySelectorAll('.el-dialog__footer button')].at(-1) as HTMLElement).click()
  await flush()
}
const savedIds = () => grantRole.mock.calls[0][1].map(String).sort()

beforeEach(() => {
  fetchMenuTree.mockReset()
  fetchRoleMenuIds.mockReset()
  grantRole.mockReset()
})
afterEach(() => {
  app?.unmount()
  app = null
  document.body.innerHTML = ''
})

describe('角色菜单授权弹窗', () => {
  it('回显等于角色实际拥有的菜单，原样保存不会把目录下的整棵子树带进来', async () => {
    await open(['1', '11', '111'])
    expect(fetchRoleMenuIds).toHaveBeenCalledWith('r1')
    expect(checkedLabels()).toEqual(['新增用户', '用户管理', '系统管理'].sort())
    await save()
    expect(grantRole).toHaveBeenCalledTimes(1)
    expect(grantRole.mock.calls[0][0]).toBe('r1')
    expect(savedIds()).toEqual(['1', '11', '111'])
  })

  it('只有页面、没有按钮的角色，原样保存不会补上按钮', async () => {
    await open(['1', '11'])
    expect(checkedLabels()).toEqual(['用户管理', '系统管理'].sort())
    await save()
    expect(savedIds()).toEqual(['1', '11'])
  })

  it('勾上页面时带上它的全部按钮和上级目录', async () => {
    await open([])
    expect(checkedLabels()).toEqual([])
    await clickCheckbox('用户管理')
    expect(checkedLabels()).toEqual(
      ['系统管理', '用户管理', '新增用户', '删除用户', '查看身份证'].sort()
    )
    await save()
    expect(savedIds()).toEqual(['1', '11', '111', '112', '113'])
  })

  it('取消页面时带走它的按钮；上级目录下没有其他勾选时一并取消', async () => {
    await open(['1', '11', '111', '112', '13'])
    await clickCheckbox('用户管理')
    expect(checkedLabels()).toEqual(['系统管理', '部门管理'].sort())
    await clickCheckbox('部门管理')
    expect(checkedLabels()).toEqual([])
    await save()
    expect(savedIds()).toEqual([])
  })
})
