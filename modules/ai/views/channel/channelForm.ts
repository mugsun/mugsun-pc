/**
 * 列表行 → 编辑表单。列表给的 Webhook 地址是打码后的（地址里带着群机器人的 key），
 * 放进输入框再存回去会把地址存坏：输入框留空表示不修改，打码后的地址只留着给提示用。
 */
export function toChannelForm(row?: Record<string, any>): Record<string, any> {
  if (!row) return { channelType: 'webhook', status: 1 }
  return { ...row, webhookUrl: '', savedWebhook: row.webhookUrl || '' }
}
