import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * 单元测试配置（与 vite.config.ts 分离：构建配置依赖 loadEnv 与大量插件，测试只需别名解析）
 * 别名须与 vite.config.ts resolve.alias 保持一致。
 */
const resolvePath = (p: string) => path.resolve(__dirname, p)

export default defineConfig({
  resolve: {
    alias: {
      '@/gis': resolvePath('modules/gis/lib'),
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
