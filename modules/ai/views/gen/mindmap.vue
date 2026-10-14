<template>
  <GenLayout type="mindmap" :title="$t('aiGen.pageMindmap')" />
</template>
<script setup lang="ts">
  import GenLayout from './GenLayout.vue'
  defineOptions({ name: 'AiGenMindmap' })
</script>
