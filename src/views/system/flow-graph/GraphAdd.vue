<!-- 节点插入选择器：审批 / 条件分支 / 并行分支 / AI -->
<template>
  <ElDropdown trigger="click" @command="(c: string) => emit('pick', c)">
    <span class="g-add-btn"><ArtSvgIcon icon="ri:add-line" /></span>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem command="approval">{{
          $t('pages.system.flowGraph.approvalNode')
        }}</ElDropdownItem>
        <ElDropdownItem command="condition">{{
          $t('pages.system.flowGraph.typeCondition')
        }}</ElDropdownItem>
        <ElDropdownItem command="parallel">{{
          $t('pages.system.flowGraph.typeParallel')
        }}</ElDropdownItem>
        <ElDropdownItem command="ai">{{ $t('pages.system.flowGraph.typeAi') }}</ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>

<script setup lang="ts">
  const emit = defineEmits<{ pick: [type: string] }>()
</script>

<style scoped>
  .g-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    font-size: 14px;
    color: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border-radius: 50%;
  }

  .g-add-btn:hover {
    background: var(--el-color-primary-light-3);
  }
</style>
