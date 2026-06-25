<template>
  <div
    class="split-node"
    :class="node.type === 'split' ? node.direction : ''"
    ref="containerRef"
  >
    <template v-if="node.type === 'leaf'">
      <div class="leaf-wrapper">
        <TerminalPane
          :id="terminal.id"
          :name="terminal.name"
          :cwd="terminal.cwd"
          :canClose="canClose"
          :isActive="activeId === terminal.id"
          :maxReached="maxReached"
          :ref="el => setRef(terminal.id, el)"
          @close="$emit('close', terminal.id)"
          @rename="(id, name) => $emit('rename', id, name)"
          @split="(id, dir) => $emit('split', id, dir)"
          @focus="(id) => $emit('focus', id)"
        />
      </div>
    </template>

    <template v-else>
      <template v-for="(child, index) in node.children" :key="index">
        <div class="child-panel" :style="getPanelStyle(index)">
          <SplitNode
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
          v-if="index < node.children.length - 1"
          class="resizer"
          :class="node.direction === 'vertical' ? 'resizer-vertical' : 'resizer-horizontal'"
          @mousedown="startResize($event, index)"
        ></div>
      </template>
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

// Find terminal object for this leaf
const terminal = computed(() => {
  if (props.node.type !== 'leaf') return {}
  return props.terminals.find(t => t.id === props.node.terminalId) || {}
})

// Local sizes (init from node or equal split)
const sizes = ref([])
watch(() => {
  if (props.node.type === 'split') {
    return props.node.children.length
  }
  return 0
}, (len) => {
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

.leaf-wrapper {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
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
