<template>
  <div
    class="resizable-panels"
    :class="direction === 'vertical' ? 'vertical' : 'horizontal'"
    ref="containerRef"
  >
    <template v-for="(item, index) in items" :key="item.id">
      <div
        class="panel"
        :style="getPanelStyle(index)"
      >
        <slot :item="item" :index="index"></slot>
      </div>
      <div
        v-if="index < items.length - 1"
        class="resizer"
        :class="direction === 'vertical' ? 'resizer-vertical' : 'resizer-horizontal'"
        @mousedown="startResize($event, index)"
      ></div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },
  direction: { type: String, default: 'horizontal' }
})

const emit = defineEmits(['resize'])

const containerRef = ref(null)
const panelSizes = ref([])
const isResizing = ref(false)
const resizeIndex = ref(-1)
const startPos = ref(0)
const startSizes = ref([])

// Initialize equal sizes
watch(() => props.items.length, (len) => {
  if (len > 0) {
    const equalSize = 100 / len
    panelSizes.value = Array(len).fill(equalSize)
  }
}, { immediate: true })

function getPanelStyle(index) {
  return { flex: `0 0 ${panelSizes.value[index] || 0}%` }
}

function startResize(event, index) {
  isResizing.value = true
  resizeIndex.value = index
  startPos.value = props.direction === 'vertical' ? event.clientY : event.clientX
  startSizes.value = [...panelSizes.value]

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = props.direction === 'vertical' ? 'row-resize' : 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(event) {
  if (!isResizing.value || !containerRef.value) return

  const isVertical = props.direction === 'vertical'
  const containerSize = isVertical ? containerRef.value.offsetHeight : containerRef.value.offsetWidth
  const currentPos = isVertical ? event.clientY : event.clientX
  const delta = currentPos - startPos.value
  const deltaPercent = (delta / containerSize) * 100

  const index = resizeIndex.value
  const newFirstSize = startSizes.value[index] + deltaPercent
  const newSecondSize = startSizes.value[index + 1] - deltaPercent

  // Minimum 10% per panel
  if (newFirstSize >= 10 && newSecondSize >= 10) {
    panelSizes.value[index] = newFirstSize
    panelSizes.value[index + 1] = newSecondSize
  }
}

function stopResize() {
  if (isResizing.value) {
    emit('resize')
  }
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
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})
</script>

<style scoped>
.resizable-panels {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  gap: 8px;
}

.resizable-panels.horizontal {
  flex-direction: row;
}

.resizable-panels.vertical {
  flex-direction: column;
}

.panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Horizontal resizer (between side-by-side panels) */
.resizer-horizontal {
  flex: 0 0 8px;
  background: transparent;
  cursor: col-resize;
  position: relative;
  z-index: 10;
  margin: 0 -8px;
}

.resizer-horizontal::before {
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

.resizer-horizontal:hover::before {
  background: rgba(255, 255, 255, 0.3);
}

.resizer-horizontal:active::before {
  background: rgba(167, 139, 250, 0.5);
}

/* Vertical resizer (between stacked panels) */
.resizer-vertical {
  flex: 0 0 8px;
  background: transparent;
  cursor: row-resize;
  position: relative;
  z-index: 10;
  margin: -8px 0;
}

.resizer-vertical::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  transition: background 0.15s ease;
}

.resizer-vertical:hover::before {
  background: rgba(255, 255, 255, 0.3);
}

.resizer-vertical:active::before {
  background: rgba(167, 139, 250, 0.5);
}
</style>
