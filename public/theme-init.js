// 首屏前按本地存储的主题给 <html> 加 dark class，避免刷新白闪。
// 独立文件而非 index.html 内联：CSP script-src 'self' 不允许内联脚本。
;(function () {
  try {
    if (typeof Storage === 'undefined' || !window.localStorage) {
      return
    }
    if (localStorage.getItem('sys-theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  } catch (e) {
    console.warn('Failed to apply initial theme:', e)
  }
})()
