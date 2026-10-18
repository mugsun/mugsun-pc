import { readFileSync } from 'node:fs'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

/**
 * 单元测试配置（与 vite.config.ts 分离：构建配置依赖 loadEnv 与大量插件，测试只需别名解析）
 * 别名须与 vite.config.ts resolve.alias 保持一致。
 */
const resolvePath = (p: string) => path.resolve(__dirname, p)
const pkgVersion: string = JSON.parse(readFileSync(resolvePath('package.json'), 'utf-8')).version

export default defineConfig({
  // 挂载测试（tests/unit/**/*.mount.test.ts）需要编译 .vue；不启用 auto-import，被测组件需显式 import
  plugins: [vue()],
  // 与 vite.config.ts define 保持一致
  define: { __PKG_VERSION__: JSON.stringify(pkgVersion) },
  resolve: {
    alias: {
      '@/gis': resolvePath('modules/gis/lib'),
      '@/api/track': resolvePath('modules/track/api.ts'),
      '@/views/track': resolvePath('modules/track/views'),
      '@': resolvePath('src'),
      '@views': resolvePath('src/views'),
      '@imgs': resolvePath('src/assets/images'),
      '@icons': resolvePath('src/assets/icons'),
      '@utils': resolvePath('src/utils'),
      '@stores': resolvePath('src/store'),
      '@styles': resolvePath('src/assets/styles')
    }
  },
  test: {
    // 组合式函数需宿主组件实例触发 onMounted，故需 DOM 环境
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    // e2e 由 Playwright 独立运行，避免 vitest 误收
    exclude: ['e2e/**', 'node_modules/**'],
    clearMocks: true,
    restoreMocks: true,
    // 时间格式化用例涉及本地时区显示，固定 TZ 保证跨机器结果一致
    env: { TZ: 'Asia/Shanghai' }
  }
})
