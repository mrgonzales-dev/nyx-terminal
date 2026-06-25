<template>
  <div
    class="split-node"
    :class="node.direction === 'vertical' ? 'vertical' : 'horizontal'"
    ref="containerRef"
  >
    <template v-for="(child, index) in nodeChildren" :key="child.type === 'leaf' ? 'leaf-' + child.terminalId : 'split-' + index">
      <div class="child-panel" :style="getPanelStyle(index)">
        <TerminalPane
          v-if="child.type === 'leaf'"
          :id="terminalFor(child).id"
          :name="terminalFor(child).name"
          :canClose="canClose"
          :isActive="activeId === terminalFor(child).id"
          :maxReached="maxReached"
          :ref="el => setRef(terminalFor(child).id, el)"
          @close="$emit('close', terminalFor(child).id)"
          @rename="(id, name) => $emit('rename', id, name)"
          @split="(id, dir) => $emit('split', id, dir)"
          @focus="(id) => $emit('focus', id)"
        />
        <SplitNode
          v-else
          :node="child"
          :terminals="terminals"
          :terminalRefs="terminalRefs"
          :canClose="canClose"
          :activeId="activeId"
          :maxReached="maxReached"
          @close="$emit('close', $event)"
          @rename="(id, name) => $emit('rename', id, name)"
          @split="(id, dir) => $emit('split', id, dir)"
          @focus="$emit('focus', $event)"
          @resize="$emit('resize')"
        />
      </div>
      <div
        v-if="index < nodeChildren.length - 1"
        class="resizer"
        :class="node.direction === 'vertical' ? 'resizer-vertical' : 'resizer-horizontal'"
        @mousedown="startResize($event, index)"
      ></div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import TerminalPane from './TerminalPane.vue'

const props = defineProps({
  node: { type: Object, required: true },
  terminals: { type: Array, required: true },
  terminalRefs: { type: Object, required: true },
  canClose: { type: Boolean, default: true },
  activeId: { type: Number, default: null },
  maxReached: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'rename', 'split', 'focus', 'resize'])

const containerRef = ref(null)
const isResizing = ref(false)
const resizeIndex = ref(-1)
const startPos = ref(0)
const startSizes = ref([])

// Normalize node to always have children array (leaf → single-child split)
const nodeChildren = computed(() => {
  if (props.node.type === 'leaf') {
    return [props.node]
  }
  return props.node.children || []
})

// Find terminal object for a leaf child
function terminalFor(child) {
  if (child.type !== 'leaf') return {}
  return props.terminals.find(t => t.id === child.terminalId) || {}
}

// Local sizes (init from node or equal split)
const sizes = ref([])
watch(() => nodeChildren.value.length, (len) => {
  if (len > 0) {
    if (props.node.sizes && props.node.sizes.length === len) {
      sizes.value = [...props.node.sizes]
    } else {
      sizes.value = Array(len).fill(100 / len)
    }
  }
}, { immediate: true })

// Sync sizes back to node
watch(sizes, (newSizes) => {
  if (props.node.type === 'split') {
    props.node.sizes = [...newSizes]
  }
}, { deep: true })

function getPanelStyle(index) {
  return { flex: `${sizes.value[index] || 0} 1 0%` }
}

function setRef(id, el) {
  if (el) {
    props.terminalRefs[id] = el
  } else {
    delete props.terminalRefs[id]
  }
}

function startResize(event, index) {
  event.preventDefault()
  event.stopPropagation()
  isResizing.value = true
  resizeIndex.value = index
  startPos.value = props.node.direction === 'vertical' ? event.clientY : event.clientX
  startSizes.value = [...sizes.value]

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = props.node.direction === 'vertical' ? 'row-resize' : 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(event) {
  if (!isResizing.value || !containerRef.value) return

  const isVertical = props.node.direction === 'vertical'
  const containerSize = isVertical ? containerRef.value.offsetHeight : containerRef.value.offsetWidth
  const currentPos = isVertical ? event.clientY : event.clientX
  const delta = currentPos - startPos.value
  const deltaPercent = (delta / containerSize) * 100

  const index = resizeIndex.value
  const newFirst = startSizes.value[index] + deltaPercent
  const newSecond = startSizes.value[index + 1] - deltaPercent

  if (newFirst >= 5 && newSecond >= 5) {
    sizes.value[index] = newFirst
    sizes.value[index + 1] = newSecond
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
.split-node {
  width: 100%;
  height: 100%;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.split-node.horizontal {
  flex-direction: row;
}

.split-node.vertical {
  flex-direction: column;
}

.child-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

/* Horizontal resizer */
.resizer-horizontal {
  flex: 0 0 6px;
  background: transparent;
  cursor: col-resize;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.resizer-horizontal::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
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

/* Vertical resizer */
.resizer-vertical {
  flex: 0 0 6px;
  background: transparent;
  cursor: row-resize;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.resizer-vertical::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 3px;
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
