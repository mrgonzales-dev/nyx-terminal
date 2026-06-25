<template>
  <div class="split-container" ref="rootRef">
    <transition name="slide-down">
      <div v-show="!collapsed" class="split-dropdown">
        <button class="split-option" @click="select('horizontal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="split-icon">
            <rect x="3" y="6" width="7" height="12" rx="1"/>
            <rect x="14" y="6" width="7" height="12" rx="1"/>
          </svg>
          <span>Horizontal</span>
        </button>
        <button class="split-option" @click="select('vertical')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="split-icon">
            <rect x="6" y="3" width="12" height="7" rx="1"/>
            <rect x="6" y="14" width="12" height="7" rx="1"/>
          </svg>
          <span>Vertical</span>
        </button>
      </div>
    </transition>
    <button
      class="split-btn"
      :class="{ active: !collapsed, disabled: disabled }"
      :disabled="disabled"
      @click="toggle"
      :title="disabled ? 'Maximum terminals reached' : 'Split terminal'"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="12" y1="3" x2="12" y2="21"/>
      </svg>
      <span v-if="label">{{ label }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineProps({
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['split'])

const collapsed = ref(true)
const rootRef = ref(null)

function toggle() {
  collapsed.value = !collapsed.value
}

function select(direction) {
  emit('split', direction)
  collapsed.value = true
}

function handleClickOutside(e) {
  if (collapsed.value) return
  const root = rootRef.value
  if (root && !root.contains(e.target)) {
    collapsed.value = true
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.split-container {
  position: relative;
  display: flex;
  align-items: center;
}

.split-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: rgba(10, 10, 15, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  padding: 6px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 12px 40px rgba(0, 0, 0, 0.6);
  z-index: 1000;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.split-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.split-option:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.split-option .split-icon {
  width: 16px;
  height: 16px;
  opacity: 0.8;
  flex-shrink: 0;
}

.split-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.split-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.split-btn.active {
  color: #c4b5fd;
  background: rgba(167, 139, 250, 0.15);
}

.split-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

.split-btn svg {
  width: 16px;
  height: 16px;
}

/* Slide down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
