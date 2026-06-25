<template>
  <div class="settings-container">
    <transition name="slide-down">
      <div v-show="!collapsed" class="settings-panel" ref="panelRef">
        <div class="settings-header">
          <span class="settings-title">Settings</span>
        </div>
        <div class="settings-section">
          <span class="settings-section-title">Transparency</span>
          <div class="settings-row">
            <span class="settings-label">Opacity</span>
            <input
              type="range"
              min="0"
              max="100"
              :value="opacity"
              @input="$emit('update:opacity', Number($event.target.value))"
              class="settings-slider"
            />
            <span class="settings-value">{{ opacity }}%</span>
          </div>
        </div>
      </div>
    </transition>
    <button
      class="settings-btn"
      :class="{ active: !collapsed }"
      @click="toggle"
      title="Settings"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  opacity: { type: Number, default: 85 }
})

defineEmits(['update:opacity'])

const collapsed = ref(true)
const panelRef = ref(null)

function toggle() {
  collapsed.value = !collapsed.value
}

function handleClickOutside(e) {
  if (collapsed.value) return
  const panel = panelRef.value
  const btn = e.target.closest('.settings-btn')
  if (panel && !panel.contains(e.target) && !btn) {
    collapsed.value = true
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(() => props.opacity, (val) => {
  document.documentElement.style.setProperty('--terminal-opacity', val / 100)
}, { immediate: true })
</script>

<style scoped>
.settings-container {
  position: relative;
  display: flex;
  align-items: center;
}

.settings-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: rgba(10, 10, 15, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  padding: 0;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 12px 40px rgba(0, 0, 0, 0.6);
  z-index: 100;
  white-space: nowrap;
  min-width: 220px;
}

.settings-header {
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-title {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  font-family: 'Inter', sans-serif;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.settings-section {
  padding: 14px 18px;
}

.settings-section-title {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'JetBrainsMono Nerd Font', monospace;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'JetBrainsMono Nerd Font', monospace;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.settings-value {
  font-size: 12px;
  color: #c4b5fd;
  font-family: 'JetBrainsMono Nerd Font', monospace;
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}

.settings-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #a78bfa;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(167, 139, 250, 0.5);
  transition: transform 0.15s ease;
}

.settings-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.settings-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #a78bfa;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 8px rgba(167, 139, 250, 0.5);
}

.settings-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.settings-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.settings-btn.active {
  color: #c4b5fd;
  background: rgba(167, 139, 250, 0.15);
}

.settings-btn svg {
  width: 18px;
  height: 18px;
}

/* Slide down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
