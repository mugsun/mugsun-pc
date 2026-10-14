/**
 * 离线图标加载器
 *
 * 启动时把用到的 Iconify 图标子集（src/assets/icons/offline-icons.json，由
 * scripts/gen-offline-icons.mjs 生成）注册进 @iconify/vue，并关掉在线 API：
 * 运行时不再请求 api.iconify.design 等外域，CSP connect-src 只需 'self'。
 *
 * 新增图标：在组件里写 <ArtSvgIcon icon="ri:xxx" /> 后重新运行生成脚本并提交 JSON；
 * 后端菜单种子数据里的图标写进 scripts/offline-icons.extra.txt。未收录的图标显示为空白，不会外联。
 *
 * @module utils/ui/iconify-loader
 * @author Mugsun
 */
import { addCollection, _api, type IconifyJSON } from '@iconify/vue'
import offlineIcons from '@/assets/icons/offline-icons.json'

for (const set of offlineIcons as unknown as IconifyJSON[]) addCollection(set)

// 禁止在线兜底：未收录的图标不发任何网络请求
_api.setFetch(() => Promise.reject(new Error('iconify online API disabled (offline icons only)')))
