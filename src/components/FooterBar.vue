<template>
  <footer class="footer">
    <button 
      class="footer-btn" 
      :class="{ active: treeOpen }"
      @click="$emit('toggle-tree')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 7h4v4H3zM3 15h4v4H3zM11 7h10M11 12h10M11 17h10"/>
      </svg>
      Files
    </button>
    
    <button class="footer-btn" @click="$emit('add-terminal')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      New Terminal
    </button>
    
    <SplitButton label="Split" @split="$emit('split', $event)" />
    
    <button 
      class="footer-btn" 
      :class="{ active: saving }"
      @click="handleSave"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Save
    </button>
  </footer>
</template>

<script setup>
import { ref } from 'vue'
import SplitButton from './SplitButton.vue'

defineProps({
  treeOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-tree', 'add-terminal', 'save', 'split'])

const saving = ref(false)

async function handleSave() {
  saving.value = true
  emit('save')
  setTimeout(() => {
    saving.value = false
  }, 500)
}
</script>

<style scoped>
.footer {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 24px;
  background: rgba(10, 10, 15, 0.9);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.footer-btn:active {
  background: rgba(255, 255, 255, 0.06);
  transform: scale(0.98);
}

.footer-btn.active {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.4);
  color: #c4b5fd;
}

.footer-btn svg {
  width: 16px;
  height: 16px;
  opacity: 0.8;
}

/* SplitButton styled as footer button */
.split-container :deep(.split-btn) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.split-container :deep(.split-btn:hover) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.split-container :deep(.split-btn.active) {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.4);
  color: #c4b5fd;
}

.split-container :deep(.split-btn svg) {
  width: 16px;
  height: 16px;
  opacity: 0.8;
}
</style>
