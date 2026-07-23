<script setup>
// 双层标题:大号超粗英文 + 小号加宽字距中文副标
defineProps({
  en: { type: String, required: true },
  zh: { type: String, required: true },
  size: { type: String, default: 'lg' }, // lg | sm
})
</script>

<template>
  <div class="dual-title" :class="size">
    <h1 class="en">{{ en }}</h1>
    <p class="zh">{{ zh }}</p>
  </div>
</template>
