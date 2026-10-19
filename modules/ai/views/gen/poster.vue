<template>
  <GenLayout type="poster" :title="$t('aiGen.pagePoster')" />
</template>
<script setup lang="ts">
  import GenLayout from './GenLayout.vue'
  defineOptions({ name: 'AiGenPoster' })
</script>
