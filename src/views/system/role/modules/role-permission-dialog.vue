<!-- 角色菜单授权弹窗（对接后端 /system/role/grant，el-tree 勾选 + /menu-ids 回显） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('pages.system.role.grantTitle')"
    width="460px"
    align-center
  >
    <ElTree
      ref="treeRef"
      class="perm-tree"
      :data="menuTree"
      node-key="id"
      show-checkbox
      check-strictly
      default-expand-all
      :props="{ label: 'menuName', children: 'children' }"
      @check="handleCheck"
    />
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">{{
          $t('pages.system.role.save')
        }}</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { fetchMenuTree } from '@/api/system-manage'
  import { fetchRoleMenuIds, grantRole } from '@/api/role'

  interface Props {
    visible: boolean
    roleData?: Record<string, any>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const { t } = useI18n()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const treeRef = ref<any>()
  const menuTree = ref<any[]>([])
  const submitting = ref(false)

  watch(
    () => props.visible,
    async (visible) => {
      if (visible && props.roleData?.id) {
        menuTree.value = (await fetchMenuTree()) || []
        const checkedIds = (await fetchRoleMenuIds(props.roleData.id)) || []
        nextTick(() => treeRef.value?.setCheckedKeys(checkedIds, false))
      }
    }
  )

  // 树不联动：联动模式下回显角色已有的目录 id 会把整棵子树勾上，原样保存就悄悄扩权。
  // 联动只在用户点击时手动做：勾上带上全部下级和上级；取消带走下级，上级下面没有勾选时一并取消。
  const handleCheck = (data: { id: number | string }) => {
    const tree = treeRef.value
    const node = tree?.getNode(data.id)
    if (!node) return
    const checked: boolean = node.checked
    const setDescendants = (parent: any) => {
      for (const child of parent.childNodes) {
        tree.setChecked(child.data.id, checked, false)
        setDescendants(child)
      }
    }
    setDescendants(node)
    for (let p = node.parent; p && p.level > 0; p = p.parent) {
      if (checked) tree.setChecked(p.data.id, true, false)
      else if (!p.childNodes.some((c: any) => c.checked)) tree.setChecked(p.data.id, false, false)
      else break
    }
  }

  const handleSubmit = async () => {
    if (!treeRef.value || !props.roleData?.id) return
    const menuIds = treeRef.value.getCheckedKeys(false)
    submitting.value = true
    try {
      await grantRole(props.roleData.id, menuIds)
      ElMessage.success(t('pages.system.role.grantSuccess'))
      dialogVisible.value = false
      emit('success')
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped>
  /* 全量菜单树 default-expand-all 展开后远超视口：限高内滚，防弹窗顶出视口 */
  .perm-tree {
    max-height: 50vh;
    overflow-y: auto;
  }
</style>
