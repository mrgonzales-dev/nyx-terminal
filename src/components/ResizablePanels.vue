<template>
  <div class="resizable-panels" ref="containerRef">
    <template v-for="(item, index) in items" :key="item.id">
      <div 
        class="panel" 
        :style="{ flex: `0 0 ${panelSizes[index]}%` }"
      >
        <slot :item="item" :index="index"></slot>
      </div>
      <div 
        v-if="index < items.length - 1"
        class="resizer"
        @mousedown="startResize($event, index)"
      ></div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  items: { type: Array, required: true }
})

const emit = defineEmits(['resize'])

const containerRef = ref(null)
const panelSizes = ref([])
const isResizing = ref(false)
const resizeIndex = ref(-1)
const startX = ref(0)
const startSizes = ref([])

// Initialize equal sizes
watch(() => props.items.length, (len) => {
  if (len > 0) {
    const equalSize = 100 / len
    panelSizes.value = Array(len).fill(equalSize)
  }
}, { immediate: true })

function startResize(event, index) {
  isResizing.value = true
  resizeIndex.value = index
  startX.value = event.clientX
  startSizes.value = [...panelSizes.value]
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(event) {
  if (!isResizing.value || !containerRef.value) return
  
  const containerWidth = containerRef.value.offsetWidth
  const deltaX = event.clientX - startX.value
  const deltaPercent = (deltaX / containerWidth) * 100
  
  const index = resizeIndex.value
  const newLeftSize = startSizes.value[index] + deltaPercent
  const newRightSize = startSizes.value[index + 1] - deltaPercent
  
  // Minimum 10% per panel
  if (newLeftSize >= 10 && newRightSize >= 10) {
    panelSizes.value[index] = newLeftSize
    panelSizes.value[index + 1] = newRightSize
    emit('resize')
  }
}

function stopResize() {
  isResizing.value = false
  resizeIndex.value = -1
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.resizable-panels {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  gap: 8px;
}

.panel {
  min-width: 0;
  overflow: hidden;
}

.resizer {
  flex: 0 0 8px;
  background: transparent;
  cursor: col-resize;
  position: relative;
  z-index: 10;
  margin: 0 -8px;
}

.resizer::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  transition: background 0.15s ease;
}

.resizer:hover::before {
  background: rgba(255, 255, 255, 0.3);
}

.resizer:active::before {
  background: rgba(167, 139, 250, 0.5);
}
</style>
