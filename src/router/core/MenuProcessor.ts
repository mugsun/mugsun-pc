/**
 * 菜单处理器
 *
 * 负责菜单数据的获取、过滤和处理
 *
 * @module router/core/MenuProcessor
 * @author Mugsun
 */

import type { AppRouteRecord } from '@/types/router'
import { useUserStore } from '@/store/modules/user'
import { useAppMode } from '@/hooks/core/useAppMode'
import { fetchGetMenuList } from '@/api/system-manage'
import { asyncRoutes } from '../routes/asyncRoutes'
import { RoutesAlias } from '../routesAlias'
import { formatMenuTitle } from '@/utils'

export class MenuProcessor {
  /**
   * 获取菜单数据
   */
  async getMenuList(): Promise<AppRouteRecord[]> {
    const { isFrontendMode } = useAppMode()

    let menuList: AppRouteRecord[]
    if (isFrontendMode.value) {
      menuList = await this.processFrontendMenu()
    } else {
      menuList = await this.processBackendMenu()
    }

    // 在规范化路径之前，验证原始路径配置
    this.validateMenuPaths(menuList)

    // 规范化路径（将相对路径转换为完整路径）
    return this.normalizeMenuPaths(menuList)
  }

  /**
   * 处理前端控制模式的菜单
   */
  private async processFrontendMenu(): Promise<AppRouteRecord[]> {
    const userStore = useUserStore()
    const roles = userStore.info?.roles

    let menuList = [...asyncRoutes]

    // 根据角色过滤菜单
    if (roles && roles.length > 0) {
      menuList = this.filterMenuByRoles(menuList, roles)
    }

    // 根据租户套餐过滤菜单（后端 /auth/info 下发 menus；超管/未绑套餐为 null，不限）
    const allowed = (userStore.info as Record<string, any>)?.menus
    if (Array.isArray(allowed) && allowed.length > 0) {
      const filtered = this.filterMenuByPackage(menuList, new Set(allowed))
      // 安全兜底：套餐配置异常导致全空时回退到不过滤，避免锁死无菜单
      if (filtered.length > 0) {
        menuList = filtered
      }
    }

    return this.filterEmptyMenus(menuList)
  }

  /**
   * 根据租户套餐可用菜单标识过滤菜单
   * 目录（有子项）在其子项存活时保留；叶子按 name 是否在白名单决定
   */
  private filterMenuByPackage(menu: AppRouteRecord[], allowed: Set<string>): AppRouteRecord[] {
    return menu.reduce((acc: AppRouteRecord[], item) => {
      const name = item.name ? String(item.name) : ''
      if (item.children?.length) {
        const children = this.filterMenuByPackage(item.children, allowed)
        if (children.length > 0 || allowed.has(name)) {
          acc.push({ ...item, children })
        }
      } else if (allowed.has(name)) {
        acc.push({ ...item })
      }
      return acc
    }, [])
  }

  /**
   * 处理后端控制模式的菜单
   * 数据源 /v3/system/menus（当前用户菜单树）；失败或空树回退前端静态路由（防菜单接口故障锁死系统）。
   * 菜单名对齐静态路由名（按全路径匹配）：租户套餐过滤/menu_keys 与工作台页签身份依赖该命名。
   */
  private async processBackendMenu(): Promise<AppRouteRecord[]> {
    let menuList: AppRouteRecord[] = []
    try {
      menuList = (await fetchGetMenuList()) || []
    } catch (e) {
      console.error('[MenuProcessor] 后端菜单接口异常，回退前端静态路由', e)
    }
    if (menuList.length === 0) {
      console.warn('[MenuProcessor] 后端菜单为空，回退前端静态路由')
      return this.processFrontendMenu()
    }

    this.adoptStaticNames(menuList)

    // 租户套餐过滤（后端 /auth/info 下发 menus；超管/未绑套餐为 null，不限）
    const userStore = useUserStore()
    const allowed = (userStore.info as Record<string, any>)?.menus
    if (Array.isArray(allowed) && allowed.length > 0) {
      const filtered = this.filterMenuByPackage(menuList, new Set(allowed))
      // 安全兜底：套餐配置异常导致全空时回退到不过滤，避免锁死无菜单
      if (filtered.length > 0) {
        menuList = filtered
      }
    }
    return this.filterEmptyMenus(menuList)
  }

  /**
   * 菜单名对齐静态路由（后端返回的派生名 → 静态路由 name）。
   * 按「父路径拼接」计算全路径与 asyncRoutes 索引匹配；匹配不到保留后端派生名（新生成/外部菜单）。
   * 标题同步对齐：命中静态路由即以其 menus.* i18n key 替换后端中文名，未命中保留后端原文。
   */
  private adoptStaticNames(menuList: AppRouteRecord[], parentPath = ''): void {
    const index = this.staticRouteIndex()
    for (const item of menuList) {
      const fullPath = this.buildFullPath(item.path || '', parentPath)
      const staticRoute = index.get(fullPath)
      if (staticRoute) {
        if (staticRoute.name) {
          item.name = staticRoute.name
        }
        if (item.meta && staticRoute.title) {
          item.meta = { ...item.meta, title: staticRoute.title }
        }
      }
      if (item.children?.length) {
        this.adoptStaticNames(item.children, fullPath)
      }
    }
  }

  /** 静态路由 全路径 → name/title 索引（惰性构建一次） */
  private _staticRouteIndex?: Map<string, { name?: string; title?: string }>
  private staticRouteIndex(): Map<string, { name?: string; title?: string }> {
    if (this._staticRouteIndex) {
      return this._staticRouteIndex
    }
    const index = new Map<string, { name?: string; title?: string }>()
    const walk = (routes: AppRouteRecord[], parentPath = '') => {
      for (const route of routes) {
        const fullPath = this.buildFullPath(route.path || '', parentPath)
        index.set(fullPath, {
          name: route.name ? String(route.name) : undefined,
          title: route.meta?.title
        })
        if (route.children?.length) {
          walk(route.children, fullPath)
        }
      }
    }
    walk(asyncRoutes)
    this._staticRouteIndex = index
    return index
  }

  /**
   * 根据角色过滤菜单
   */
  private filterMenuByRoles(menu: AppRouteRecord[], roles: string[]): AppRouteRecord[] {
    return menu.reduce((acc: AppRouteRecord[], item) => {
      const itemRoles = item.meta?.roles
      const hasPermission = !itemRoles || itemRoles.some((role) => roles?.includes(role))

      if (hasPermission) {
        const filteredItem = { ...item }
        if (filteredItem.children?.length) {
          filteredItem.children = this.filterMenuByRoles(filteredItem.children, roles)
        }
        acc.push(filteredItem)
      }

      return acc
    }, [])
  }

  /**
   * 递归过滤空菜单项
   */
  private filterEmptyMenus(menuList: AppRouteRecord[]): AppRouteRecord[] {
    return menuList
      .map((item) => {
        // 如果有子菜单，先递归过滤子菜单
        if (item.children && item.children.length > 0) {
          const filteredChildren = this.filterEmptyMenus(item.children)
          return {
            ...item,
            children: filteredChildren
          }
        }
        return item
      })
      .filter((item) => {
        // 如果定义了 children 属性（即使是空数组），说明这是一个目录菜单，应该保留
        if ('children' in item) {
          return true
        }

        // 如果有外链或 iframe，保留
        if (item.meta?.isIframe === true || item.meta?.link) {
          return true
        }

        // 如果有有效的 component，保留
        if (item.component && item.component !== '' && item.component !== RoutesAlias.Layout) {
          return true
        }

        // 其他情况过滤掉
        return false
      })
  }

  /**
   * 验证菜单列表是否有效
   */
  validateMenuList(menuList: AppRouteRecord[]): boolean {
    return Array.isArray(menuList) && menuList.length > 0
  }

  /**
   * 规范化菜单路径
   * 将相对路径转换为完整路径，确保菜单跳转正确
   */
  private normalizeMenuPaths(menuList: AppRouteRecord[], parentPath = ''): AppRouteRecord[] {
    return menuList.map((item) => {
      // 构建完整路径
      const fullPath = this.buildFullPath(item.path || '', parentPath)

      // 递归处理子菜单
      const children = item.children?.length
        ? this.normalizeMenuPaths(item.children, fullPath)
        : item.children

      const redirect = item.redirect || this.resolveDefaultRedirect(children)

      return {
        ...item,
        path: fullPath,
        redirect,
        children
      }
    })
  }

  /**
   * 为目录型菜单推导默认跳转地址
   */
  private resolveDefaultRedirect(children?: AppRouteRecord[]): string | undefined {
    if (!children?.length) {
      return undefined
    }

    for (const child of children) {
      if (this.isNavigableRoute(child)) {
        return child.path
      }

      const nestedRedirect = this.resolveDefaultRedirect(child.children)
      if (nestedRedirect) {
        return nestedRedirect
      }
    }

    return undefined
  }

  /**
   * 判断子路由是否可以作为默认落点
   */
  private isNavigableRoute(route: AppRouteRecord): boolean {
    return Boolean(
      route.path &&
        route.path !== '/' &&
        !route.meta?.link &&
        route.meta?.isIframe !== true &&
        route.component &&
        route.component !== ''
    )
  }

  /**
   * 验证菜单路径配置
   * 检测非一级菜单是否错误使用了 / 开头的路径
   */
  /**
   * 验证菜单路径配置
   * 检测非一级菜单是否错误使用了 / 开头的路径
   */
  private validateMenuPaths(menuList: AppRouteRecord[], level = 1): void {
    menuList.forEach((route) => {
      if (!route.children?.length) return

      const parentName = String(route.name || route.path || '未知路由')

      route.children.forEach((child) => {
        const childPath = child.path || ''

        // 跳过合法的绝对路径：外部链接和 iframe 路由
        if (this.isValidAbsolutePath(childPath)) return

        // 绝对路径：能对上静态路由的是分组目录与真实地址前缀不一致（如 AI 二级目录），
        // 前端按绝对地址跳转，不记配置错误。对不上静态路由的仍然报错。
        if (childPath.startsWith('/') && !this.staticRouteIndex().has(childPath)) {
          this.logPathError(child, childPath, parentName, level)
        }
      })

      // 递归检查更深层级的子路由
      this.validateMenuPaths(route.children, level + 1)
    })
  }

  /**
   * 判断是否为合法的绝对路径
   */
  private isValidAbsolutePath(path: string): boolean {
    return (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('/outside/iframe/')
    )
  }

  /**
   * 输出路径配置错误日志
   */
  private logPathError(
    route: AppRouteRecord,
    path: string,
    parentName: string,
    level: number
  ): void {
    const routeName = String(route.name || path || '未知路由')
    const menuTitle = route.meta?.title || routeName
    const suggestedPath = path.split('/').pop() || path.slice(1)

    console.error(
      `[路由配置错误] 菜单 "${formatMenuTitle(menuTitle)}" (name: ${routeName}, path: ${path}) 配置错误\n` +
        `  位置: ${parentName} > ${routeName}\n` +
        `  问题: ${level + 1}级菜单的 path 不能以 / 开头\n` +
        `  当前配置: path: '${path}'\n` +
        `  应该改为: path: '${suggestedPath}'`
    )
  }

  /**
   * 构建完整路径
   */
  private buildFullPath(path: string, parentPath: string): string {
    if (!path) return ''

    // 外部链接直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // 如果已经是绝对路径，直接返回
    if (path.startsWith('/')) {
      return path
    }

    // 拼接父路径和当前路径
    if (parentPath) {
      // 移除父路径末尾的斜杠，移除子路径开头的斜杠，然后拼接
      const cleanParent = parentPath.replace(/\/$/, '')
      const cleanChild = path.replace(/^\//, '')
      return `${cleanParent}/${cleanChild}`
    }

    // 没有父路径，添加前导斜杠
    return `/${path}`
  }
}
