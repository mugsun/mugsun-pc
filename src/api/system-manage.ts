import request from '@/utils/http'
import { AppRouteRecord } from '@/types/router'

// 用户域 → @/api/user，角色域 → @/api/role，字典域 → @/api/dict（均 openapi 生成类型，无 any）
// ===== 部门 =====
export function fetchDeptTree(params?: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/dept/tree', params })
}
export function fetchDeptSelect() {
  return request.get<Array<{ label: string; value: string }>>({ url: '/api/system/dept/select' })
}
export function fetchSaveDept(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/dept/submit', data })
}
export function fetchRemoveDept(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/dept/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}

// ===== 岗位 =====
export function fetchGetPostList(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/post/page', params })
}
/** 岗位下拉选项（value=id / label=岗位名） */
export function fetchPostSelect() {
  return request.get<Array<{ label: string; value: number }>>({ url: '/api/system/post/select' })
}
export function fetchSavePost(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/post/submit', data })
}
export function fetchRemovePost(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/post/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}

// 获取角色列表
// ===== 角色 =====（CRUD/授权/下拉已迁至 @/api/role）
// 菜单树
export function fetchMenuTree() {
  return request.get<any[]>({ url: '/api/system/menu/tree' })
}
export function fetchSaveMenu(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/menu/submit', data })
}
export function fetchRemoveMenu(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/menu/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}

// ===== 参数 =====
export function fetchParamList(params?: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/param/list', params })
}
export function fetchSaveParam(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/param/submit', data })
}
export function fetchRemoveParam(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/param/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}

// ===== 邮件模板 =====
export function fetchMailTemplatePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/mail-template/page', params })
}
export function fetchSaveMailTemplate(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/mail-template/submit', data })
}
export function fetchRemoveMailTemplate(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/mail-template/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}
export function fetchSendTestMail(data: Record<string, any>) {
  return request.post<string>({ url: '/api/system/mail-template/send-test', data })
}

// ===== 系统字典 / 业务字典 =====（树/批量/CRUD 已迁至 @/api/dict）

// ===== 租户 =====
export function fetchTenantList(params?: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/tenant/list', params })
}
export function fetchCreateTenant(data: Record<string, any>) {
  return request.post<string>({ url: '/api/system/tenant/create', data })
}
export function fetchRemoveTenant(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/tenant/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}
export function fetchUpdateTenant(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/tenant/update', data })
}

// ===== 租户套餐 =====
export function fetchTenantPackagePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/tenant-package/page', params })
}
export function fetchTenantPackageList() {
  return request.get<any[]>({ url: '/api/system/tenant-package/list' })
}
export function fetchSubmitTenantPackage(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/tenant-package/submit', data })
}
export function fetchRemoveTenantPackage(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/tenant-package/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}

// ===== 通知公告 =====
export function fetchNoticePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/notice/page', params })
}
export function fetchNoticeDetail(id: number | string) {
  return request.get<any>({ url: '/api/system/notice/detail', params: { id } })
}
export function fetchSaveNotice(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/notice/submit', data })
}
export function fetchRemoveNotice(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/notice/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}
/** 某公告的阅读记录分页（谁读了/次数/首末时间） */
export function fetchNoticeReadPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/notice/read/page', params })
}
/** 我可见的通知分页（按可见范围过滤 + 已读标记） */
export function fetchMyNoticePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/notice/my/page', params })
}
/** 标记通知已读（幂等，首读计 UV） */
export function fetchReadNotice(noticeId: number | string) {
  return request.post<void>({ url: `/api/system/notice/read/${noticeId}` })
}
/** 我的未读通知数 */
export function fetchMyNoticeUnreadCount() {
  return request.get<number>({ url: '/api/system/notice/my/unread-count' })
}

// ===== 附件 =====
export function fetchUploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<any>({ url: '/api/system/file/upload', data: form })
}
/** 直传签发回执（supported=false 表示当前平台不支持预签名，回退 multipart） */
export interface PresignedPutResult {
  supported: boolean
  uploadUrl?: string
  headers?: Record<string, string>
  ticket?: string
  expiresIn?: number
}
/** 两段式直传·签发 PUT 预签名（一次性 ticket 凭证） */
export function fetchPresignedPut(data: { filename: string; access?: string }) {
  return request.post<PresignedPutResult>({ url: '/api/system/file/presigned-put', data })
}
/** 两段式直传·回填登记（ticket 一次性，size 客户端上报展示值） */
export function fetchCreateAttach(data: { ticket: string; size?: number }) {
  return request.post<any>({ url: '/api/system/file/create', data })
}
export function fetchRemoveAttach(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/file/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}

// ===== 操作日志 =====
export function fetchOperLogPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/oper-log/page', params })
}
/** 审计完整性验签：重算哈希链 + SM2 验签，定位首个被篡改记录（limit>0 只校最近 N 条） */
export function fetchOperLogVerify(limit?: number) {
  return request.get<any>({ url: '/api/system/oper-log/verify', params: { limit } })
}

// ===== 访问日志 =====
export function fetchApiLogPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/api-log/page', params })
}

// ===== 错误日志 =====
export function fetchErrorLogPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/error-log/page', params })
}
export function fetchErrorLogDetail(id: number | string) {
  return request.get<any>({ url: '/api/system/error-log/detail', params: { id } })
}
/** 认领处理：status 1 已处理 / 2 已忽略，附处理备注 */
export function fetchHandleErrorLog(data: { id: number | string; status: number; note?: string }) {
  return request.post<void>({ url: '/api/system/error-log/handle', data })
}
export function fetchRemoveErrorLog(id: number | string) {
  return request.del<void>({ url: '/api/system/error-log/remove', params: { id } })
}

// ===== 服务监控 =====
/** 拉取 actuator 指标明细（经 /api 代理转发；端点受 sys:monitor:list 鉴权，请求头自动携带 token；裸 micrometer JSON 无 R 信封，走 skipEnvelope 旁路） */
export function fetchActuatorMetric(name: string) {
  return request.get<any>({ url: `/api/actuator/metrics/${name}`, skipEnvelope: true })
}
/** 在线数据库文档 markdown（在线查看 + 下载） */
export function fetchDbDoc() {
  return request.get<string>({ url: '/api/system/monitor/db-doc' })
}

// ===== 数据变更记录 =====
export function fetchDataAuditPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/data-audit/page', params })
}
export function fetchDataAuditDetail(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/data-audit/detail', params })
}

// ===== 对象存储配置 =====
export function fetchOssPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/oss/page', params })
}
export function fetchSaveOss(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/oss/submit', data })
}
export function fetchRemoveOss(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/oss/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}
export function fetchEnableOss(id: number | string) {
  return request.post<void>({ url: `/api/system/oss/enable/${id}` })
}

// ===== 短信平台配置 =====
export function fetchSmsPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/sms/page', params })
}
export function fetchSaveSms(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/sms/submit', data })
}
export function fetchRemoveSms(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/sms/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}
export function fetchEnableSms(id: number | string) {
  return request.post<void>({ url: `/api/system/sms/enable/${id}` })
}

// ===== 在线代码生成 =====
export function fetchGenDatasource() {
  return request.get<any>({ url: '/api/system/gen/datasource' })
}
export function fetchGenTables() {
  return request.get<any[]>({ url: '/api/system/gen/tables' })
}
// 元数据驱动代码生成（gen_table/gen_column）
export function fetchGenImport(data: {
  tableName: string
  moduleName?: string
  basePackage?: string
  tablePrefix?: string
  author?: string
}) {
  return request.post<number | string>({ url: '/api/system/gen/import', data })
}
export function fetchGenList() {
  return request.get<any[]>({ url: '/api/system/gen/list' })
}
export function fetchGenMeta(tableId: number | string) {
  return request.get<{ table: any; columns: any[] }>({
    url: '/api/system/gen/meta',
    params: { tableId }
  })
}
export function fetchSaveGenMeta(data: { table: any; columns: any[] }) {
  return request.post<void>({ url: '/api/system/gen/meta/save', data })
}
export function fetchGenSync(tableId: number | string) {
  return request.post<void>({ url: '/api/system/gen/sync', params: { tableId } })
}
export function fetchGenPreviewMeta(tableId: number | string) {
  return request.get<Record<string, string>>({
    url: '/api/system/gen/preview-meta',
    params: { tableId }
  })
}
export function downloadGenZip(tableId: number | string) {
  return request.download({
    url: '/api/system/gen/download',
    params: { tableId },
    filename: `mugsun-gen-${tableId}.zip`
  })
}
// 在线（低代码）运行时表单
export function fetchOnlineForms() {
  return request.get<any[]>({ url: '/api/system/online-form/forms' })
}
export function fetchOnlineMeta(tableId: number | string) {
  return request.get<{ table: any; columns: any[] }>({
    url: '/api/system/online-form/meta',
    params: { tableId }
  })
}
export function fetchOnlineData(tableId: number | string, params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/online-form/page', params: { tableId, ...params } })
}
export function fetchOnlineDetail(tableId: number | string, id: number | string) {
  return request.get<any>({ url: '/api/system/online-form/detail', params: { tableId, id } })
}
export function fetchOnlineSave(tableId: number | string, data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/online-form/save', params: { tableId }, data })
}
export function fetchOnlineRemove(tableId: number | string, ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/online-form/remove',
    params: { tableId },
    data: ids
  })
}

// 动态建表 / AI 辅助建模（data:{} 保 params 留在 query，供 @RequestParam 绑定）
export function fetchDdlPreview(tableId: number | string, force = false) {
  return request.get<string[]>({ url: '/api/system/gen/ddl/preview', params: { tableId, force } })
}
export function fetchDdlCreate(tableId: number | string) {
  return request.post<void>({ url: '/api/system/gen/ddl/create', params: { tableId }, data: {} })
}
export function fetchDdlSync(tableId: number | string, force = false) {
  return request.post<void>({
    url: '/api/system/gen/ddl/sync',
    params: { tableId, force },
    data: {}
  })
}
export function fetchAiDraft(description: string) {
  return request.post<{ table: any; columns: any[] }>({
    url: '/api/system/gen/ai/draft',
    data: { description }
  })
}
export function fetchAiConfirm(data: { table: any; columns: any[]; build: boolean }) {
  return request.post<number | string>({ url: '/api/system/gen/ai/confirm', data })
}

// ===== 工作流治理 =====
export function fetchFlowDefinitions() {
  return request.get<any[]>({ url: '/api/system/flow/definitions' })
}
export function fetchFlowDeploy() {
  return request.post<string>({ url: '/api/system/flow/deploy' })
}
export function fetchFlowStart(businessId: string) {
  return request.post<string>({ url: `/api/system/flow/start/${encodeURIComponent(businessId)}` })
}
/** 图形设计部署：结构化设计生成 warm-flow 定义并发布 */
export function fetchFlowDesign(data: Record<string, any>) {
  return request.post<number>({ url: '/api/system/flow/design', data })
}
/** 图形流程部署：递归节点树（条件分支/并行/会签）翻译并发布 */
export function fetchFlowDesignGraph(data: Record<string, any>) {
  return request.post<number>({ url: '/api/system/flow/design-graph', data })
}
/** 定义管理：发布/取消发布/启用/停用/复制新版本/删除 */
export function fetchFlowDefPublish(id: number | string) {
  return request.post<void>({ url: `/api/system/flow/definition/publish/${id}` })
}
export function fetchFlowDefUnpublish(id: number | string) {
  return request.post<void>({ url: `/api/system/flow/definition/unpublish/${id}` })
}
export function fetchFlowDefActive(id: number | string) {
  return request.post<void>({ url: `/api/system/flow/definition/active/${id}` })
}
export function fetchFlowDefSuspend(id: number | string) {
  return request.post<void>({ url: `/api/system/flow/definition/suspend/${id}` })
}
export function fetchFlowDefCopy(id: number | string) {
  return request.post<void>({ url: `/api/system/flow/definition/copy/${id}` })
}
export function fetchFlowDefRemove(ids: (number | string)[]) {
  return request.post<void>({ url: '/api/system/flow/definition/remove', data: ids.map(String) })
}
/** 发起指定流程码实例；可选发起人自选办理人 handlers + 发起业务数据 variable */
export function fetchFlowStartBy(
  flowCode: string,
  businessId: string,
  param?: { handlers?: string[]; variable?: Record<string, any> }
) {
  return request.post<string>({
    url: `/api/system/flow/start-by/${encodeURIComponent(flowCode)}/${encodeURIComponent(businessId)}`,
    data: param ?? {}
  })
}
/** 发起表单：流程发起节点绑定表单（发起页填业务数据） */
export function fetchFlowStartForm(flowCode: string) {
  return request.get<Record<string, any>>({
    url: '/api/system/flow/form/start',
    params: { flowCode }
  })
}
/** 办理表单：任务节点绑定表单 + 已填数据 + 字段级权限 */
export function fetchFlowTaskForm(taskId: number | string) {
  return request.get<Record<string, any>>({
    url: '/api/system/flow/form/task',
    params: { taskId }
  })
}
/** 查看表单：实例业务数据只读回显 */
export function fetchFlowInstanceForm(instanceId: number | string) {
  return request.get<Record<string, any>>({
    url: '/api/system/flow/form/instance',
    params: { instanceId }
  })
}
export function fetchFlowMyTodo() {
  return request.get<any[]>({ url: '/api/system/flow/my-todo' })
}
export function fetchFlowMyCopy() {
  return request.get<any[]>({ url: '/api/system/flow/my-copy' })
}
/** 审批中心·我发起 */
export function fetchFlowMyStarted() {
  return request.get<any[]>({ url: '/api/system/flow/my-started' })
}
/** 审批中心·已办 */
export function fetchFlowMyDone() {
  return request.get<any[]>({ url: '/api/system/flow/my-done' })
}
/** 流程图进度：节点+状态 */
export function fetchFlowProgress(instanceId: number | string) {
  return request.get<any[]>({ url: '/api/system/flow/progress', params: { instanceId } })
}
/** 下一节点审批人预测 */
export function fetchFlowNextApprovers(taskId: number | string) {
  return request.get<any[]>({ url: '/api/system/flow/next-approvers', params: { taskId } })
}
/** 通用审批弹窗按钮 buttonList */
export function fetchFlowTaskButtons(taskId: number | string) {
  return request.get<string[]>({ url: '/api/system/flow/task-buttons', params: { taskId } })
}
export function fetchFlowHandle(
  taskId: number | string,
  message?: string,
  variable?: Record<string, any>
) {
  return request.post<string>({
    url: `/api/system/flow/task/handle/${taskId}`,
    data: { message, variable }
  })
}
/** 退回上一步（修正后语义：退回而非终止作废） */
export function fetchFlowReject(taskId: number | string, message?: string) {
  return request.post<string>({ url: `/api/system/flow/task/reject/${taskId}`, data: { message } })
}
/** 退回指定历史节点 */
export function fetchFlowRejectNode(taskId: number | string, nodeCode: string, message?: string) {
  return request.post<string>({
    url: `/api/system/flow/task/reject-node/${taskId}`,
    data: { nodeCode, message }
  })
}
/** 撤回（发起人） */
export function fetchFlowRevoke(instanceId: number | string, message?: string) {
  return request.post<string>({
    url: `/api/system/flow/task/revoke/${instanceId}`,
    data: { message }
  })
}
/** 作废（终止实例） */
export function fetchFlowTerminate(taskId: number | string, message?: string) {
  return request.post<string>({
    url: `/api/system/flow/task/terminate/${taskId}`,
    data: { message }
  })
}
/** 转办/委派/加签/减签 单入口 */
export function fetchFlowOperation(
  taskId: number | string,
  op: string,
  handlers: (number | string)[],
  message?: string
) {
  return request.post<void>({
    url: `/api/system/flow/task/operation/${taskId}`,
    data: { op, handlers: handlers.map(String), message }
  })
}
/** 抄送 */
export function fetchFlowCopy(taskId: number | string, userIds: (number | string)[]) {
  return request.post<void>({
    url: `/api/system/flow/task/copy/${taskId}`,
    data: { userIds: userIds.map(String) }
  })
}
/** 可退回的历史审批节点 */
export function fetchFlowBackNodes(instanceId: number | string) {
  return request.get<any[]>({ url: '/api/system/flow/back-nodes', params: { instanceId } })
}
export function fetchFlowHistory(instanceId: number | string) {
  return request.get<any[]>({ url: '/api/system/flow/history', params: { instanceId } })
}

// ===== 定时任务 =====
export function fetchJobList() {
  return request.get<any[]>({ url: '/api/system/job/list' })
}
/** 处理器注册表（BasicProcessor 实现，value=全限定类名 label=简单类名） */
export function fetchJobProcessors() {
  return request.get<Array<{ label: string; value: string }>>({ url: '/api/system/job/processors' })
}
export function fetchSaveJob(data: Record<string, any>) {
  return request.post<number>({ url: '/api/system/job/save', data })
}
export function fetchRunJob(jobId: number | string) {
  return request.post<string>({ url: `/api/system/job/run/${jobId}` })
}
export function fetchEnableJob(jobId: number | string) {
  return request.post<void>({ url: `/api/system/job/enable/${jobId}` })
}
export function fetchDisableJob(jobId: number | string) {
  return request.post<void>({ url: `/api/system/job/disable/${jobId}` })
}
export function fetchDeleteJob(jobId: number | string) {
  return request.post<void>({ url: `/api/system/job/delete/${jobId}` })
}
export function fetchJobInstances(jobId: number | string) {
  return request.get<any[]>({ url: '/api/system/job/instances', params: { jobId } })
}

// ===== 报表 =====
export function fetchReportDatasets() {
  return request.get<any[]>({ url: '/api/system/report/datasets' })
}
export function fetchReportList() {
  return request.get<any[]>({ url: '/api/system/report/list' })
}
export function fetchSaveReport(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/report/submit', data })
}
export function fetchRemoveReport(id: number | string) {
  return request.post<void>({ url: `/api/system/report/remove/${id}` })
}
export function fetchReportPreview(id: number | string) {
  return request.get<any[]>({ url: '/api/system/report/preview', params: { id } })
}
/** 按内置数据集 key 取聚合数据（多图表仪表盘逐图取数） */
export function fetchReportPreviewDataset(key: string) {
  return request.get<any[]>({ url: '/api/system/report/preview-dataset', params: { key } })
}

// ===== 登录日志 =====
export function fetchLoginLogPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/login-log/page', params })
}

// ===== 在线会话 =====
/** 在线会话列表（每行 = 一个在线终端，会话落 Redis 重启不失效） */
export function fetchOnlineList() {
  return request.get<any[]>({ url: '/api/system/online/list' })
}
/** 强制下线：按 loginId+deviceType(+tokenMask) 踢单端（服务端解析真实 token，前端不持明文） */
export function fetchKickoutOnline(data: {
  loginId: string
  deviceType?: string
  tokenMask?: string
}) {
  return request.post<void>({ url: '/api/system/online/kickout', data })
}
/** 清理失效会话：用户已删/不存在的 Redis 会话整账号踢出，返回清理终端数 */
export function fetchCleanupStaleOnline() {
  return request.post<number>({ url: '/api/system/online/cleanup-stale' })
}

// ===== API 密钥 =====
export function fetchApiKeyPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/api-key/page', params })
}
export function fetchGenerateApiKey(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/api-key/generate', data })
}
export function fetchEnableApiKey(id: number | string) {
  return request.post<void>({ url: `/api/system/api-key/enable/${id}` })
}
export function fetchDisableApiKey(id: number | string) {
  return request.post<void>({ url: `/api/system/api-key/disable/${id}` })
}
export function fetchRemoveApiKey(id: number | string) {
  return request.post<void>({ url: `/api/system/api-key/remove/${id}` })
}

// ===== 行政区划 =====
export function fetchRegionLazyTree(parentCode: string) {
  return request.get<any[]>({ url: '/api/system/region/lazy-tree', params: { parentCode } })
}
export function fetchSaveRegion(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/region/submit', data })
}
export function fetchRemoveRegion(id: number | string) {
  return request.post<void>({ url: `/api/system/region/remove/${id}` })
}
export function exportRegion(): Promise<void> {
  return request.download({ url: '/api/system/region/export', filename: '行政区划.xlsx' })
}
export function importRegion(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<number>({ url: '/api/system/region/import', data: form })
}

// ===== 个人中心 =====
export function fetchUpdateInfo(data: Record<string, any>) {
  return request.post<void>({ url: '/api/auth/update-info', data })
}
export function fetchUpdatePassword(data: Record<string, any>) {
  return request.post<void>({ url: '/api/auth/update-password', data })
}
/** 更新头像（/system/file/upload 公开区产物 URL，落 sys_user.avatar） */
export function fetchUpdateAvatar(data: { avatar: string }) {
  return request.post<void>({ url: '/api/auth/update-avatar', data })
}
/** 头像上传：公开区登记（img 直显免授权下载），返回 SysAttach 取 url */
export function uploadAvatarFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  form.append('access', 'public')
  return request.post<any>({ url: '/api/system/file/upload', data: form })
}

// 获取菜单列表
export function fetchGetMenuList() {
  return request.get<AppRouteRecord[]>({
    url: '/api/v3/system/menus'
  })
}
