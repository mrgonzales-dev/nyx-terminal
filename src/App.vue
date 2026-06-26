<template>
  <Transition name="loader-fade">
    <div v-if="loading" class="loader-overlay">
      <div class="loader-logo">
        <span class="loader-bracket">&gt;</span><span class="loader-underscore">_</span>
        <h1 class="loader-name">NYX</h1>
        <span class="loader-sub">terminal</span>
      </div>
    </div>
  </Transition>
  <Banner :opacity="opacity" @update:opacity="opacity = $event" />
  <main class="main-content">
    <div class="terminals-area" ref="areaRef">
      <template v-for="cell in flatCells" :key="'cell-' + cell.leaf.terminalId">
        <TerminalPane
          :id="cell.leaf.terminalId"
          :name="termName(cell.leaf.terminalId)"
          :canClose="terminals.length > 1"
          :isActive="activeTerminalId === cell.leaf.terminalId"
          :maxReached="terminals.length >= MAX_TERMINALS"
          :ref="(el) => { if (el) terminalRefs[cell.leaf.terminalId] = el; else delete terminalRefs[cell.leaf.terminalId] }"
          :style="{
            position: 'absolute',
            left: 'calc(' + cell.x + '% + var(--gap))',
            top: 'calc(' + cell.y + '% + var(--gap))',
            width: 'calc(' + cell.w + '% - var(--gap) * 2)',
            height: 'calc(' + cell.h + '% - var(--gap) * 2)',
            boxSizing: 'border-box'
          }"
          @close="closeTerminal"
          @rename="renameTerminal"
          @split="splitTerminal"
          @focus="setActiveTerminal"
        />
      </template>
      <div
        v-for="(d, di) in dividers"
        :key="'d-' + d.path.join('-') + '-' + d.idx"
        class="resize-handle"
        :class="'resize-' + d.direction"
        :style="{
          position: 'absolute',
          left: d.direction === 'horizontal' ? d.x + '%' : 'calc(' + d.x + '% + var(--gap))',
          top: d.direction === 'vertical' ? d.y + '%' : 'calc(' + d.y + '% + var(--gap))',
          width: d.direction === 'horizontal' ? '6px' : 'calc(' + d.w + '% - var(--gap) * 2)',
          height: d.direction === 'vertical' ? '6px' : 'calc(' + d.h + '% - var(--gap) * 2)'
        }"
        @mousedown="startResize($event, d)"
      />
    </div>
  </main>
  <FooterBar
    :maxReached="terminals.length >= MAX_TERMINALS"
    @add-terminal="addTerminal"
    @save="saveSession"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Banner from './components/Banner.vue'
import FooterBar from './components/FooterBar.vue'
import TerminalPane from './components/TerminalPane.vue'
import { useSession } from './composables/useSession'

const { loadSession, saveSession: save } = useSession()

const terminals = ref([])
const opacity = ref(85)
const activeTerminalId = ref(null)
const terminalRefs = ref({})
const areaRef = ref(null)
const loading = ref(true)
let terminalCounter = 0
const MAX_TERMINALS = 4

// Layout tree — pure data, no recursive rendering
const layout = ref({ type: 'split', direction: 'horizontal', children: [], sizes: [] })

function termName(id) {
  return terminals.value.find(t => t.id === id)?.name || 'nyx terminal'
}

// Flatten tree to absolute-positioned cells (gap added via CSS calc)
function flattenTree(node, x, y, w, h) {
  if (node.type === 'leaf') {
    return [{ leaf: node, x, y, w, h }]
  }
  if (!node.children || node.children.length === 0) return []
  if (node.children.length === 1) {
    return flattenTree(node.children[0], x, y, w, h)
  }

  const sizes = node.sizes || node.children.map(() => 100 / node.children.length)
  const cells = []

  if (node.direction === 'horizontal') {
    let cx = x
    const total = sizes.reduce((a, b) => a + b, 0) || 100
    for (let i = 0; i < node.children.length; i++) {
      const cw = (w * sizes[i]) / total
      cells.push(...flattenTree(node.children[i], cx, y, cw, h))
      cx += cw
    }
  } else {
    let cy = y
    const total = sizes.reduce((a, b) => a + b, 0) || 100
    for (let i = 0; i < node.children.length; i++) {
      const ch = (h * sizes[i]) / total
      cells.push(...flattenTree(node.children[i], x, cy, w, ch))
      cy += ch
    }
  }

  return cells
}

const flatCells = computed(() => {
  return flattenTree(layout.value, 0, 0, 100, 100)
})

// Dividers between siblings in split nodes — draggable resize handles
const dividers = computed(() => {
  const result = []
  function walk(node, x, y, w, h, path) {
    if (node.type !== 'split' || !node.children || node.children.length < 2) return
    const sizes = node.sizes || node.children.map(() => 100 / node.children.length)
    const total = sizes.reduce((a, b) => a + b, 0) || 100

    if (node.direction === 'horizontal') {
      let cx = x
      for (let i = 0; i < node.children.length; i++) {
        const cw = (w * sizes[i]) / total
        walk(node.children[i], cx, y, cw, h, [...path, i])
        cx += cw
        if (i < node.children.length - 1) {
          result.push({
            x: cx,
            y,
            w: 0,
            h,
            direction: 'horizontal',
            path: [...path],
            idx: i
          })
        }
      }
    } else {
      let cy = y
      for (let i = 0; i < node.children.length; i++) {
        const ch = (h * sizes[i]) / total
        walk(node.children[i], x, cy, w, ch, [...path, i])
        cy += ch
        if (i < node.children.length - 1) {
          result.push({
            x,
            y: cy,
            w,
            h: 0,
            direction: 'vertical',
            path: [...path],
            idx: i
          })
        }
      }
    }
  }
  walk(layout.value, 0, 0, 100, 100, [])
  return result
})

function onPanelsResize() {
  Object.values(terminalRefs.value).forEach(ref => {
    if (ref && ref.fit) ref.fit()
  })
}

// Drag-to-resize split pane dividers
function startResize(event, divider) {
  event.preventDefault()

  const areaEl = areaRef.value
  if (!areaEl) return
  const areaRect = areaEl.getBoundingClientRect()

  // Walk the tree using the path to find the split node's bounding box (in %)
  let bx = 0, by = 0, bw = 100, bh = 100
  let node = layout.value
  for (const idx of divider.path) {
    if (node.type !== 'split') return
    const sizes = node.sizes || node.children.map(() => 100 / node.children.length)
    const total = sizes.reduce((a, b) => a + b, 0) || 100
    if (node.direction === 'horizontal') {
      const before = sizes.slice(0, idx).reduce((a, b) => a + b, 0)
      bx += (bw * before) / total
      bw = (bw * sizes[idx]) / total
    } else {
      const before = sizes.slice(0, idx).reduce((a, b) => a + b, 0)
      by += (bh * before) / total
      bh = (bh * sizes[idx]) / total
    }
    node = node.children[idx]
  }

  // Find the split node itself via path
  let splitNode = layout.value
  for (const idx of divider.path) {
    splitNode = splitNode.children[idx]
  }
  if (splitNode.type !== 'split') return

  const startSizes = [...(splitNode.sizes || splitNode.children.map(() => 100 / splitNode.children.length))]
  const isHorizontal = divider.direction === 'horizontal'
  const splitPixelSize = isHorizontal
    ? (bw / 100) * areaRect.width
    : (bh / 100) * areaRect.height
  const totalSize = startSizes.reduce((a, b) => a + b, 0) || 100
  const minPct = 10 // minimum % a pane can take

  function onMove(e) {
    const deltaPx = isHorizontal ? e.clientX - event.clientX : e.clientY - event.clientY
    const deltaPct = splitPixelSize > 0 ? (deltaPx / splitPixelSize) * totalSize : 0

    const newLayout = cloneLayout(layout.value)
    // Re-navigate in the clone
    let target = newLayout
    for (const idx of divider.path) {
      target = target.children[idx]
    }
    if (target.type !== 'split') return

    const a = startSizes[divider.idx] + deltaPct
    const b = startSizes[divider.idx + 1] - deltaPct

    // Clamp both children to minimum
    if (a < minPct || b < minPct) return

    target.sizes[divider.idx] = a
    target.sizes[divider.idx + 1] = b

    layout.value = newLayout
    nextTick(onPanelsResize)
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
  }

  document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function createTerminal(name = null) {
  const id = ++terminalCounter
  terminals.value.push({ id, name: name || 'nyx terminal' })
  return id
}

function addTerminal() {
  const id = createTerminal()
  const leaf = { type: 'leaf', terminalId: id }

  // If root is a leaf (single terminal after close collapsed it),
  // wrap it in a split so we can add the new sibling
  if (layout.value.type === 'leaf') {
    const existingId = layout.value.terminalId
    layout.value = {
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'leaf', terminalId: existingId },
        leaf
      ],
      sizes: [50, 50]
    }
  } else {
    layout.value.children.push(leaf)
    const equal = 100 / layout.value.children.length
    layout.value.sizes = Array(layout.value.children.length).fill(equal)
  }

  activeTerminalId.value = id
  nextTick(onPanelsResize)
}

if (typeof window !== 'undefined') {
  window.nyxAddTerminal = addTerminal
}

// Find parent node containing leaf with terminalId
function findParent(node, id) {
  if (node.type === 'split') {
    for (const child of node.children) {
      if (child.type === 'leaf' && child.terminalId === id) return node
      const found = findParent(child, id)
      if (found) return found
    }
  }
  return null
}

// Deep clone the layout so Vue sees a new reference
function cloneLayout(node) {
  if (node.type === 'leaf') return { type: 'leaf', terminalId: node.terminalId }
  return {
    type: 'split',
    direction: node.direction,
    children: node.children.map(cloneLayout),
    sizes: [...(node.sizes || [])]
  }
}

// Split: insert new leaf as sibling in the tree
function splitTerminal(terminalId, direction) {
  const id = terminalId || activeTerminalId.value
  if (!id) return
  if (terminals.value.length >= MAX_TERMINALS) return

  activeTerminalId.value = id

  // If root is a leaf (single terminal), replace it with a split
  if (layout.value.type === 'leaf') {
    const newId = createTerminal()
    layout.value = {
      type: 'split',
      direction,
      children: [
        { type: 'leaf', terminalId: id },
        { type: 'leaf', terminalId: newId }
      ],
      sizes: [50, 50]
    }
    activeTerminalId.value = newId
    nextTick(onPanelsResize)
    return
  }

  const parent = findParent(layout.value, id)
  let idx = -1
  let targetParent = null

  if (!parent) {
    idx = layout.value.children.findIndex(c => c.type === 'leaf' && c.terminalId === id)
    if (idx === -1) return
    targetParent = layout.value
  } else {
    idx = parent.children.findIndex(c => c.type === 'leaf' && c.terminalId === id)
    if (idx === -1) return
    targetParent = parent
  }

  const newId = createTerminal()

  // Clone entire layout tree, apply mutation to clone, then replace
  const newLayout = cloneLayout(layout.value)

  // Find the corresponding parent in the cloned tree
  const cloneParent = parent ? findParent(newLayout, id) : newLayout
  if (!cloneParent || !cloneParent.children) {
    console.error('[splitTerminal] Failed to find parent in cloned tree', { id, parent, cloneParent, layout: layout.value })
    return
  }
  const cloneIdx = cloneParent.children.findIndex(c => c.type === 'leaf' && c.terminalId === id)

  if (cloneIdx === -1) {
    console.error('[splitTerminal] Failed to find leaf in cloned tree', { id, cloneParent, layout: layout.value })
    return
  }

  if (cloneParent.direction === direction) {
    cloneParent.children.splice(cloneIdx + 1, 0, { type: 'leaf', terminalId: newId })
    const equal = cloneParent.children.length
    cloneParent.sizes = Array(equal).fill(100 / equal)
  } else {
    cloneParent.children[cloneIdx] = {
      type: 'split',
      direction,
      children: [
        { type: 'leaf', terminalId: id },
        { type: 'leaf', terminalId: newId }
      ],
      sizes: [50, 50]
    }
    cloneParent.sizes = Array(cloneParent.children.length).fill(100 / cloneParent.children.length)
  }

  layout.value = newLayout
  activeTerminalId.value = newId
  nextTick(onPanelsResize)
}

function closeTerminal(id) {
  if (terminals.value.length <= 1) return

  // Remove from layout tree
  function removeFromTree(node) {
    if (node.type !== 'split') return
    node.children = node.children.filter(child => {
      if (child.type === 'leaf' && child.terminalId === id) return false
      if (child.type === 'split') {
        removeFromTree(child)
        if (child.children.length === 1) {
          Object.assign(child, child.children[0])
        }
      }
      return true
    })
    if (node.children.length === 1) {
      Object.assign(node, node.children[0])
    }
    if (node.type === 'split' && node.children.length > 0) {
      const equal = 100 / node.children.length
      node.sizes = Array(node.children.length).fill(equal)
    }
  }

  removeFromTree(layout.value)

  // Collapse root if it has a single child
  if (layout.value.type === 'split' && layout.value.children.length === 1) {
    layout.value = layout.value.children[0]
  }

  // Remove from terminals
  terminals.value = terminals.value.filter(t => t.id !== id)
  delete terminalRefs.value[id]

  if (activeTerminalId.value === id) {
    activeTerminalId.value = terminals.value[0]?.id || null
  }

  nextTick(onPanelsResize)
}

function renameTerminal(id, name) {
  const term = terminals.value.find(t => t.id === id)
  if (term) term.name = name
}

function setActiveTerminal(id) {
  activeTerminalId.value = id
}

function serializeLayout(node) {
  if (node.type === 'leaf') return { type: 'leaf', terminalId: node.terminalId }
  return {
    type: 'split',
    direction: node.direction,
    children: node.children.map(serializeLayout),
    sizes: [...(node.sizes || [])]
  }
}

function deserializeLayout(node) {
  if (!node) return null
  if (node.type === 'leaf') return { type: 'leaf', terminalId: node.terminalId }
  return {
    type: 'split',
    direction: node.direction,
    children: (node.children || []).map(deserializeLayout),
    sizes: [...(node.sizes || [])]
  }
}

// Get all terminal IDs referenced in a layout tree
function getTerminalIdsFromLayout(node) {
  if (node.type === 'leaf') return [node.terminalId]
  return (node.children || []).flatMap(getTerminalIdsFromLayout)
}

async function saveSession() {
  await save({
    terminals: terminals.value.map(t => ({ id: t.id, name: t.name })),
    opacity: opacity.value,
    layout: serializeLayout(layout.value)
  })
}

let saveTimer = null
let sessionLoaded = false
function scheduleSave() {
  if (!sessionLoaded) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSession, 500)
}

watch([terminals, opacity, layout], scheduleSave, { deep: true })

onMounted(async () => {
  const session = await loadSession()

  if (session.terminals && session.terminals.length > 0) {
    const maxId = Math.max(...session.terminals.map(t => t.id || 0))
    terminalCounter = maxId
    session.terminals.forEach(t => {
      terminals.value.push({ id: t.id, name: t.name || 'nyx terminal' })
    })

    if (session.layout && session.layout.type === 'split' && session.layout.children?.length > 0) {
      layout.value = deserializeLayout(session.layout)
    } else {
      // No layout or old format — build flat horizontal row
      layout.value = {
        type: 'split',
        direction: 'horizontal',
        children: session.terminals.map(t => ({ type: 'leaf', terminalId: t.id })),
        sizes: session.terminals.map(() => 100 / session.terminals.length)
      }
    }

    // Remove orphaned terminals not referenced in layout
    const layoutIds = new Set(getTerminalIdsFromLayout(layout.value))
    terminals.value = terminals.value.filter(t => layoutIds.has(t.id))

    activeTerminalId.value = terminals.value[0]?.id || null
  } else {
    addTerminal()
  }

  opacity.value = session.opacity ?? 85
  sessionLoaded = true
  nextTick(onPanelsResize)

  // Hold loader for 3s so shell init clears before terminals show
  setTimeout(() => { loading.value = false }, 3000)
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<style scoped>
.main-content {
  flex: 1;
  display: flex;
  padding: 20px;
  gap: 16px;
  min-height: 0;
  overflow: hidden;
}

.terminals-area {
  --gap: 4px;
  flex: 1;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Loading screen */
.loader-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loader-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  animation: loader-pulse 1.6s ease-in-out infinite;
}

.loader-bracket {
  font-family: 'JetBrainsMono Nerd Font', monospace;
  font-size: 42px;
  font-weight: 900;
  color: #a78bfa;
  line-height: 1;
}

.loader-underscore {
  font-family: 'JetBrainsMono Nerd Font', monospace;
  font-size: 42px;
  font-weight: 900;
  color: #a78bfa;
  line-height: 1;
  animation: loader-blink 1s step-end infinite;
}

.loader-name {
  font-family: 'JetBrainsMono Nerd Font', monospace;
  font-size: 32px;
  font-weight: 900;
  color: #fff;
  letter-spacing: 8px;
  margin-top: 12px;
}

.loader-sub {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 4px;
  text-transform: uppercase;
}

@keyframes loader-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@keyframes loader-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.loader-fade-leave-active {
  transition: opacity 0.4s ease;
}

.loader-fade-leave-to {
  opacity: 0;
}

/* Resize handles between split panes */
.resize-handle {
  z-index: 50;
  user-select: none;
}

.resize-handle::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 1px;
  background: rgba(167, 139, 250,0.2);
  filter: blur(6px);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.resize-handle:hover::after {
  opacity: 1;
}

.resize-horizontal {
  cursor: col-resize;
  transform: translateX(-50%);
}

.resize-vertical {
  cursor: row-resize;
  transform: translateY(-50%);
}
</style>
