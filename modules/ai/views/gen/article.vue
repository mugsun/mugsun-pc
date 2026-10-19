<template>
  <GenLayout type="article" :title="$t('aiGen.pageArticle')" />
</template>
<script setup lang="ts">
  import GenLayout from './GenLayout.vue'
  defineOptions({ name: 'AiGenArticle' })
</script>
