/** 问数「数据分析 / 数据预测」发给后端的问题：固定中文，不跟界面语言变 */
export function analyzeQuestion(sql: string): string {
  return `基于 SQL 分析：${sql}`
}

export function predictQuestion(sql: string): string {
  return `基于 SQL 预测：${sql}`
}
