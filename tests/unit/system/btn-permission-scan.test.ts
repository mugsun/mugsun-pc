import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'

/**
 * 按钮权限扫描：src/views 下所有删除、导出、导入、新增、编辑类按钮
 * 必须带 v-perm（或 v-if/v-show 里调 hasPerm，渲染函数里用 hasPerm 包住），
 * 否则必须列进 EXEMPT 并写明原因。新加危险按钮忘挂码会在这里失败。
 *
 * 判定：@click / onClick 表达式按驼峰拆词后含下列任一词。
 */
const KEYWORDS = new Set([
  'remove',
  'delete',
  'del',
  'export',
  'import',
  'create',
  'add',
  'edit',
  'splice'
])

/** 豁免表：`文件:@click 表达式` → 原因 */
const EXEMPT: Record<string, string> = {
  'src/views/system/api-scope/index.vue:editVisible = false': '对话框「取消」，只关弹窗',
  'src/views/system/data-scope/index.vue:editVisible = false': '对话框「取消」，只关弹窗',
  'src/views/system/top-menu/index.vue:editVisible = false': '对话框「取消」，只关弹窗',
  'src/views/system/form-designer/index.vue:createVisible = false': '对话框「取消」，只关弹窗',
  'src/views/system/form-designer/index.vue:submitCreate':
    '新建对话框内的提交；打开它的按钮已挂 sys:form:save',
  'src/views/system/flow-def/index.vue:addNode': '设计器内本地加节点，保存时才调接口',
  'src/views/system/flow-def/index.vue:removeNode(idx)':
    '设计器内本地删节点（splice），保存时才调接口',
  'src/views/system/flow-def/index.vue:addCandidate(node)': '设计器内本地加候选人',
  'src/views/system/flow-def/index.vue:node.candidates.splice(ci, 1)': '设计器内本地删候选人',
  'src/views/system/flow-graph/GraphChain.vue:removeNode(idx)': '流程图组件本地删节点',
  'src/views/system/flow-graph/GraphChain.vue:node.candidates.splice(ci, 1)':
    '流程图组件本地删候选人',
  'src/views/system/flow-graph/GraphChain.vue:node.branches.splice(bi, 1)': '流程图组件本地删分支',
  'src/views/system/flow-graph/GraphChain.vue:b.conditions.splice(ri, 1)': '流程图组件本地删条件',
  'src/views/system/gen-modeling/index.vue:candidate.columns.splice($index, 1)': '建模表单本地删列',
  'src/views/system/gen-modeling/index.vue:addCol': '建模表单本地加列',
  'src/views/system/gen-modeling/index.vue:editing.columns.splice($index, 1)': '建模表单本地删列',
  'src/views/system/gen-modeling/index.vue:addEditCol': '建模表单本地加列',
  'src/views/system/report/index.vue:addChart': '报表表单本地加图表，保存时才调接口',
  'src/views/system/report/index.vue:removeChart(idx)': '报表表单本地删图表',
  'src/views/system/message-send/index.vue:form.vars.splice(i, 1)': '发送表单本地删变量',
  'src/views/system/message/index.vue:removeSelected':
    '个人站内信：MessageController /remove 只校验登录（无 @SaCheckPermission），只删本人消息；依赖后端按归属删除（id + 当前用户 + 当前租户）',
  'src/views/system/message/index.vue:removeOne(row)':
    '同上，个人站内信单条删除；依赖后端按归属删除（id + 当前用户 + 当前租户）',
  'src/views/system/user/modules/user-import-dialog.vue:downloadUserImportTemplate()':
    '导入弹窗内按钮；打开弹窗的按钮已挂 sys:user:add。导入独立权限码待 boot fd95232 合入 main 后再改',
  'src/views/system/user/modules/user-import-dialog.vue:handleImport': '同上，导入弹窗内的提交'
}

const ROOT = resolve(__dirname, '../../../')
const words = (s: string) => (s.match(/[A-Za-z][a-z0-9]*/g) || []).map((w) => w.toLowerCase())
const dangerous = (expr: string) => words(expr).some((w) => KEYWORDS.has(w))

type Node = { type: number; tag?: string; props?: any[]; children?: Node[]; loc: any }

function scan() {
  const files = (readdirSync(resolve(ROOT, 'src/views'), { recursive: true }) as string[])
    .filter((f) => /\.(vue|ts|tsx)$/.test(f))
    .map((f) => 'src/views/' + f.split('\\').join('/'))
  const hits: { key: string; where: string; guarded: boolean }[] = []
  for (const file of files) {
    const src = readFileSync(resolve(ROOT, file), 'utf8')
    if (file.endsWith('.vue')) {
      const tpl = parse(src).descriptor.template
      const walk = (n: Node) => {
        if (n.type === 1 && (n.tag === 'ElButton' || n.tag === 'el-button')) {
          const click = n.props?.find((p) => p.type === 7 && p.name === 'on')?.exp?.content
          const guarded = !!n.props?.some(
            (p) =>
              p.type === 7 &&
              (p.name === 'perm' ||
                (['if', 'show'].includes(p.name) && /hasPerm\(/.test(p.exp?.content ?? '')))
          )
          if (click && dangerous(click))
            hits.push({ key: `${file}:${click}`, where: `${file}:${n.loc.start.line}`, guarded })
        }
        n.children?.forEach(walk)
      }
      if (tpl) walk(tpl.ast as unknown as Node)
    }
    // 渲染函数：h(ElButton, { ... onClick: () => xxx }) 前面要有 hasPerm(...) ?
    const re = /h\(\s*ElButton\b[\s\S]{0,400}?onClick:\s*\(\)\s*=>\s*([\w.]+(?:\([^)]*\))?)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      if (!dangerous(m[1])) continue
      const before = src.slice(Math.max(0, m.index - 120), m.index)
      const line = src.slice(0, m.index).split('\n').length
      hits.push({
        key: `${file}:${m[1]}`,
        where: `${file}:${line}`,
        guarded: /hasPerm\(/.test(before)
      })
    }
  }
  return hits
}

describe('views 下危险按钮必须挂权限码', () => {
  const hits = scan()

  it('扫到了按钮（防止扫描失效变成空跑）', () => {
    expect(hits.filter((h) => h.guarded).length).toBeGreaterThan(20)
  })

  it('没挂 v-perm / hasPerm 的都在豁免表里', () => {
    const missing = hits
      .filter((h) => !h.guarded && !(h.key in EXEMPT))
      .map((h) => h.where + ' ' + h.key)
    expect(
      missing,
      '新增危险按钮请挂 v-perm（以后端 @SaCheckPermission 为准）或列进 EXEMPT 写明原因'
    ).toEqual([])
  })

  it('豁免表没有失效条目，且每条都写了原因', () => {
    const unguarded = new Set(hits.filter((h) => !h.guarded).map((h) => h.key))
    for (const [k, why] of Object.entries(EXEMPT)) {
      expect(unguarded.has(k), `豁免条目已不存在或已挂码，请删掉：${k}`).toBe(true)
      expect(why.trim().length).toBeGreaterThan(0)
    }
  })
})
