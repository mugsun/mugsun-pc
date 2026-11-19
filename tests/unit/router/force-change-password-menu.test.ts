/**
 * 强制改密期间的菜单：只注册改密表单所在的个人中心，不取后端菜单、不按角色过滤。
 * 背景：这时后端除改密、登出、身份接口外一律拒绝，菜单接口取不到；回退静态路由再按角色过滤，
 * 持自定义角色的用户会被滤掉整棵 /system，改密页落到 404、改不了密。
 */
import { describe, expect, it, vi } from 'vitest'

const stub = vi.hoisted(() => ({ fetchMenus: vi.fn() }))
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({ info: { roles: ['custom_role'] } })
}))
vi.mock('@/hooks/core/useAppMode', () => ({
  useAppMode: () => ({ isFrontendMode: { value: false } })
}))
vi.mock('@/api/system-manage', () => ({ fetchGetMenuList: stub.fetchMenus }))
vi.mock('@/utils', () => ({ formatMenuTitle: (title: string) => title }))

import { MenuProcessor } from '@/router/core/MenuProcessor'
import { asyncRoutes } from '@/router/routes/asyncRoutes'

const FORCE_CHANGE_PASSWORD_PATH = '/system/user-center'

describe('强制改密期间的菜单', () => {
  it('只有个人中心一页，目录壳和页面都不带角色限制', () => {
    const list = new MenuProcessor().getForceChangePasswordMenuList(FORCE_CHANGE_PASSWORD_PATH)

    expect(list).toHaveLength(1)
    const shell = list[0]
    expect(shell.path).toBe('/system')
    expect(shell.component).toBe('/index/index')
    expect(shell.meta.roles).toBeUndefined()
    expect(shell.redirect).toBe(FORCE_CHANGE_PASSWORD_PATH)
    expect(shell.children).toHaveLength(1)

    const page = shell.children?.[0]
    expect(page?.path).toBe(FORCE_CHANGE_PASSWORD_PATH)
    expect(page?.name).toBe('UserCenter')
    expect(page?.component).toBe('/system/user-center')
    expect(page?.meta.roles).toBeUndefined()
  })

  it('不去取后端菜单：这时菜单接口必被拒绝，取了只会多一条报错', () => {
    new MenuProcessor().getForceChangePasswordMenuList(FORCE_CHANGE_PASSWORD_PATH)

    expect(stub.fetchMenus).not.toHaveBeenCalled()
  })

  it('不改动静态路由表本身：/system 原有的角色限制和其他页面都还在', () => {
    new MenuProcessor().getForceChangePasswordMenuList(FORCE_CHANGE_PASSWORD_PATH)

    const system = asyncRoutes.find((route) => route.path === '/system')
    expect(system?.meta.roles).toEqual(['R_SUPER', 'R_ADMIN'])
    expect(system?.children?.length).toBeGreaterThan(1)
  })

  it('静态路由里找不到这一页时返回空数组，由调用方按取不到菜单处理', () => {
    expect(new MenuProcessor().getForceChangePasswordMenuList('/no/such/page')).toEqual([])
  })
})
