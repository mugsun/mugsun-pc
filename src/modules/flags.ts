/** 可选模块开关（构建期）：false 时不注册路由/插件，且可配合删除 modules/* 目录 */
export const enableGis = import.meta.env.VITE_ENABLE_GIS !== 'false'
export const enableTrack = import.meta.env.VITE_ENABLE_TRACK !== 'false'
