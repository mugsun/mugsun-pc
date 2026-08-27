<!-- 通知公告新增/编辑弹窗：分类/置顶/富文本内容 + 可见范围（全部 / 按员工·部门穿梭框） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? $t('pages.system.notice.addBtn') : $t('pages.system.notice.editTitle')"
    width="820px"
    align-center
    class="notice-dialog"
    @open="onOpen"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
      <ElFormItem :label="$t('pages.system.notice.colTitle')" prop="title">
        <ElInput
          v-model="formData.title"
          :placeholder="$t('pages.system.notice.formTitlePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.notice.colCategory')" prop="category">
        <ElSelect
          v-model="formData.category"
          :placeholder="$t('pages.system.notice.formCategoryPlaceholder')"
          style="width: 220px"
        >
          <ElOption
            v-for="opt in CATEGORY_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.notice.colTop')" prop="isTop">
        <ElSwitch v-model="formData.isTop" :active-value="1" :inactive-value="0" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.notice.colScope')" prop="allVisible">
        <ElRadioGroup v-model="formData.allVisible">
          <ElRadio :value="1">{{ $t('pages.system.notice.scopeAll') }}</ElRadio>
          <ElRadio :value="0">{{ $t('pages.system.notice.scopeCustom') }}</ElRadio>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem
        v-if="formData.allVisible === 0"
        :label="$t('pages.system.notice.scopeTargetLabel')"
      >
        <ElTransfer
          v-model="selectedKeys"
          :data="transferData"
          filterable
          :filter-method="onTransferFilter"
          :titles="[
            $t('pages.system.notice.transferSourceTitle'),
            $t('pages.system.notice.transferTargetTitle')
          ]"
          :props="{ key: 'key', label: 'label' }"
          class="notice-transfer"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.notice.contentLabel')" prop="content">
        <ArtWangEditor v-model="formData.content" height="300px" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton :disabled="saving" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleSubmit">{{
          $t('pages.system.notice.submitBtn')
        }}</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import ArtWangEditor from '@/components/core/forms/art-wang-editor/index.vue'
  import { fetchNoticeDetail } from '@/api/system-manage'
  import { fetchDeptSelect } from '@/api/system-manage'
  import { useUserSelectSearch } from '@/hooks'
  import { useI18n } from 'vue-i18n'

  interface Props {
    visible: boolean
    type: string
    noticeData?: Record<string, any>
    saving?: boolean
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', form: Record<string, any>): void
  }

  const props = withDefaults(defineProps<Props>(), { saving: false })
  const emit = defineEmits<Emits>()

  const { t } = useI18n()

  const CATEGORY_OPTIONS = [
    { label: t('pages.system.notice.categoryNotice'), value: 'notice' },
    { label: t('pages.system.notice.categoryAnnouncement'), value: 'announcement' },
    { label: t('pages.system.notice.categoryWarning'), value: 'warning' }
  ]

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const formRef = ref<FormInstance>()

  const defaultForm = () => ({
    id: undefined as number | string | undefined,
    title: '',
    category: 'notice',
    isTop: 0,
    allVisible: 1,
    content: ''
  })
  const formData = reactive<Record<string, any>>(defaultForm())

  // 穿梭框：员工(u:)与部门(d:)合并为一个数据源，key 前缀区分类型。
  // 员工成千账号场景不下全量：远程搜索（默认 50 条 + 关键字防抖），部门量小全量本地过滤
  const { userOptions, searchUsers, syncSelected, ensureUsers } = useUserSelectSearch()
  const deptOptions = ref<Array<{ label: string; value: number | string }>>([])
  const selectedKeys = ref<string[]>([])

  const transferData = computed(() => [
    ...deptOptions.value.map((d) => ({
      key: `d:${d.value}`,
      label: t('pages.system.notice.transferDeptLabel', { name: d.label })
    })),
    ...userOptions.value.map((u) => ({
      key: `u:${u.value}`,
      label: t('pages.system.notice.transferUserLabel', { name: u.label })
    }))
  ])

  /** 穿梭框过滤：部门本地过滤；关键字变化时防抖触发员工远程搜索（远程结果本身即匹配，直接放行） */
  let lastFilterQuery = ''
  const onTransferFilter = (query: string, item: Record<string, any>): boolean => {
    if (query !== lastFilterQuery) {
      lastFilterQuery = query
      searchUsers(query)
    }
    return String(item.label ?? '').includes(query)
  }

  // 已选员工同步进选项缓存，防远程结果刷新后已选标签退化为原始 id
  watch(selectedKeys, (keys) => {
    syncSelected(keys.filter((k) => k.startsWith('u:')).map((k) => Number(k.slice(2))))
  })

  const rules: FormRules = {
    title: [
      {
        required: true,
        message: t('pages.system.notice.formTitlePlaceholder'),
        trigger: 'blur'
      }
    ],
    category: [
      {
        required: true,
        message: t('pages.system.notice.formCategoryPlaceholder'),
        trigger: 'change'
      }
    ]
  }

  const loadTransferSource = async () => {
    if (deptOptions.value.length) return
    deptOptions.value = (await fetchDeptSelect()) || []
  }

  const onOpen = async () => {
    Object.assign(formData, defaultForm(), props.noticeData || {})
    selectedKeys.value = []
    formRef.value?.clearValidate()
    await loadTransferSource()
    // 编辑态：拉详情回显可见范围明细（员工选项按 id 精确补拉，保证已选标签完整）
    if (props.type === 'edit' && formData.id != null) {
      const detail = await fetchNoticeDetail(formData.id)
      formData.allVisible = detail?.allVisible ?? 1
      selectedKeys.value = (detail?.scopeList || []).map(
        (s: any) => `${s.scopeType === 2 ? 'd' : 'u'}:${s.scopeId}`
      )
      const userIds = (detail?.scopeList || [])
        .filter((s: any) => s.scopeType !== 2)
        .map((s: any) => Number(s.scopeId))
      if (userIds.length) await ensureUsers(userIds)
    }
  }

  const handleSubmit = async () => {
    if (props.saving || !formRef.value) return
    await formRef.value.validate((valid) => {
      if (!valid) return
      if (formData.allVisible === 0 && selectedKeys.value.length === 0) {
        ElMessage.warning(t('pages.system.notice.scopeRequired'))
        return
      }
      const scopeList =
        formData.allVisible === 0
          ? selectedKeys.value.map((k) => {
              const [type, id] = k.split(':')
              return { scopeType: type === 'd' ? 2 : 1, scopeId: id }
            })
          : []
      emit('submit', { ...formData, scopeList })
    })
  }
</script>

<style lang="scss" scoped>
  .notice-transfer {
    width: 100%;

    :deep(.el-transfer-panel) {
      width: 300px;
    }
  }
</style>

<!-- 弹窗内容 teleport 到 body，穿梭框+富文本叠加超高时需非 scoped 类限定滚动（同 track-app-dialog 范式），防矮视口下提交按钮挤出视口 -->
<style>
  .notice-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
