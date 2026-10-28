<script setup lang="ts">
// The mark alone: the folded paper M, for the header, the ledger preview and anywhere a
// square-ish brand signal is needed. Colors follow --ori-1..4 like the full wordmark.
withDefaults(defineProps<{ height?: number, label?: string, shadow?: boolean }>(), { height: 28, label: '', shadow: false })
</script>

<template>
  <OrigamiWord text="M" :height="height" :label="label" :shadow="shadow" class="origami-mark" />
</template>
