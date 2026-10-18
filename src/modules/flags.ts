/** 可选模块开关（构建期）：false 时不注册路由/插件，且可配合删除 modules/* 目录 */
export const enableGis = import.meta.env.VITE_ENABLE_GIS !== 'false'
export const enableTrack = import.meta.env.VITE_ENABLE_TRACK !== 'false'
export const enableAi = import.meta.env.VITE_ENABLE_AI !== 'false'

/**
 * GIS 运行期是否可用：构建期开关打开（GIS 代码在包里），且后端 /auth/info 下发 gisEnabled 为 true。
 * gisEnabled 缺失或不是 true（旧缓存、旧后端）一律当作关闭。
 */
export function isGisRuntimeOn(
  info: { gisEnabled?: boolean } | null | undefined,
  buildFlag: boolean = enableGis
): boolean {
  return buildFlag && info?.gisEnabled === true
}
