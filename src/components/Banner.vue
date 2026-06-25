<template>
  <header class="banner">
    <div class="banner-left">
      <h1>Nyx</h1>
      <span class="subtitle">Terminal Emulator</span>
    </div>
    <Settings :opacity="opacity" @update:opacity="$emit('update:opacity', $event)" />
  </header>
</template>

<script setup>
import Settings from './Settings.vue'

defineProps({
  opacity: { type: Number, default: 85 }
})

defineEmits(['update:opacity'])
</script>

<style scoped>
.banner {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(10, 10, 15, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.banner-left {
  display: flex;
  align-items: center;
}

.banner h1 {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.subtitle {
  margin-left: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 400;
}
</style>
