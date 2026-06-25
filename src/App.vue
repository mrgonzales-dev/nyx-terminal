<template>
  <Banner :opacity="opacity" @update:opacity="opacity = $event" />
  <main class="main-content">
    <div class="terminals-area">
      <SplitNode
        :node="layout"
        :terminals="terminals"
        :terminalRefs="terminalRefs"
        :canClose="terminals.length > 1"
        :activeId="activeTerminalId"
        @close="closeTerminal"
        @rename="renameTerminal"
        @split="splitTerminal"
        @focus="setActiveTerminal"
        @resize="onPanelsResize"
      />
    </div>
  </main>
  <FooterBar
    @add-terminal="addTerminalHorizontal"
    @save="saveSession"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Banner from './components/Banner.vue'
import FooterBar from './components/FooterBar.vue'
import SplitNode from './components/SplitNode.vue'
import { useSession } from './composables/useSession'

const { loadSession, saveSession: save } = useSession()

const terminals = ref([])
const opacity = ref(85)
const activeTerminalId = ref(null)
const terminalRefs = ref({})
let terminalCounter = 0

// Layout tree: { type: 'leaf', terminalId } or { type: 'split', direction, children: [], sizes: [] }
const layout = ref({ type: 'leaf', terminalId: null })

function onPanelsResize() {
  Object.values(terminalRefs.value).forEach(ref => {
    if (ref && ref.fit) {
      ref.fit()
    }
  })
}

function createTerminal(cwd = null, name = null) {
  const id = ++terminalCounter
  terminals.value.push({
    id,
    name: name || 'nyx terminal',
    cwd
  })
  return id
}

function addTerminal(cwd = null, name = null) {
  const id = createTerminal(cwd, name)
  layout.value = { type: 'leaf', terminalId: id }
  activeTerminalId.value = id
}

if (typeof window !== 'undefined') {
  window.nyxAddTerminal = addTerminalHorizontal
}

// Find leaf node in tree by terminalId
function findLeaf(node, terminalId) {
  if (node.type === 'leaf' && node.terminalId === terminalId) return node
  if (node.type === 'split') {
    for (const child of node.children) {
      const found = findLeaf(child, terminalId)
      if (found) return found
    }
  }
  return null
}

// i3-style split: replace focused terminal's leaf with a split node
async function splitTerminal(terminalId, direction) {
  const id = terminalId || activeTerminalId.value
  if (!id) return

  activeTerminalId.value = id

  // Get actual cwd from the terminal's PTY process
  let cwd = null
  const termRef = terminalRefs.value[id]
  if (termRef && termRef.getCwd) {
    cwd = await termRef.getCwd()
  }

  const leaf = findLeaf(layout.value, id)
  if (!leaf) return
  const newId = createTerminal(cwd)

  // Mutate leaf in-place into a split
  const oldTerminalId = leaf.terminalId
  leaf.type = 'split'
  leaf.direction = direction
  leaf.children = [
    { type: 'leaf', terminalId: oldTerminalId },
    { type: 'leaf', terminalId: newId }
  ]
  leaf.sizes = [50, 50]
  delete leaf.terminalId

  activeTerminalId.value = newId
  setTimeout(onPanelsResize, 50)
}

function splitActiveTerminal(direction) {
  if (!activeTerminalId.value) {
    addTerminal()
    return
  }
  splitTerminal(activeTerminalId.value, direction)
}

// Footer "New Terminal" — fresh terminal at home, added horizontally
function addTerminalHorizontal() {
  if (!activeTerminalId.value) {
    addTerminal()
    return
  }
  // Split active terminal horizontally but with home cwd (not inherited)
  const id = activeTerminalId.value
  const leaf = findLeaf(layout.value, id)
  if (!leaf) return
  const newId = createTerminal(null) // null = home

  const oldTerminalId = leaf.terminalId
  leaf.type = 'split'
  leaf.direction = 'horizontal'
  leaf.children = [
    { type: 'leaf', terminalId: oldTerminalId },
    { type: 'leaf', terminalId: newId }
  ]
  leaf.sizes = [50, 50]
  delete leaf.terminalId

  activeTerminalId.value = newId
  setTimeout(onPanelsResize, 50)
}

function closeTerminal(id) {
  if (terminals.value.length <= 1) return

  // Remove from layout tree
  function removeFromTree(node) {
    if (node.type !== 'split') return

    node.children = node.children.filter(child => {
      if (child.type === 'leaf' && child.terminalId === id) {
        return false
      }
      if (child.type === 'split') {
        removeFromTree(child)
        if (child.type === 'split' && child.children.length === 1) {
          const only = child.children[0]
          Object.assign(child, only)
        }
      }
      return true
    })

    // Collapse if only 1 child remains
    if (node.children.length === 1) {
      const only = node.children[0]
      Object.assign(node, only)
    }

    // Rebalance sizes
    if (node.type === 'split' && node.children.length > 0) {
      const equal = 100 / node.children.length
      node.sizes = Array(node.children.length).fill(equal)
    }
  }

  removeFromTree(layout.value)

  // Root collapse
  if (layout.value.type === 'split' && layout.value.children.length === 1) {
    layout.value = layout.value.children[0]
  }

  // Remove from terminals array
  terminals.value = terminals.value.filter(t => t.id !== id)

  if (activeTerminalId.value === id) {
    activeTerminalId.value = terminals.value[0]?.id || null
  }

  delete terminalRefs.value[id]
  setTimeout(onPanelsResize, 50)
}

function renameTerminal(id, name) {
  const term = terminals.value.find(t => t.id === id)
  if (term) term.name = name
}

function setActiveTerminal(id) {
  activeTerminalId.value = id
}

function serializeLayout(node) {
  if (node.type === 'leaf') {
    return { type: 'leaf', terminalId: node.terminalId }
  }
  return {
    type: 'split',
    direction: node.direction,
    children: node.children.map(serializeLayout),
    sizes: [...(node.sizes || [])]
  }
}

function deserializeLayout(node) {
  if (!node) return null
  if (node.type === 'leaf') {
    return { type: 'leaf', terminalId: node.terminalId }
  }
  return {
    type: 'split',
    direction: node.direction,
    children: (node.children || []).map(deserializeLayout),
    sizes: [...(node.sizes || [])]
  }
}

// Get all terminal IDs referenced in a layout tree
function getTerminalIdsFromLayout(node) {
  if (node.type === 'leaf') {
    return [node.terminalId]
  }
  if (node.type === 'split') {
    return node.children.flatMap(getTerminalIdsFromLayout)
  }
  return []
}

async function saveSession() {
  await save({
    terminals: terminals.value.map(t => ({ id: t.id, name: t.name, cwd: t.cwd })),
    opacity: opacity.value,
    layout: serializeLayout(layout.value)
  })
}

let saveTimer = null
let sessionLoaded = false
function scheduleSave() {
  if (!sessionLoaded) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSession, 1000)
}

watch([terminals, opacity, layout], scheduleSave, { deep: true })

onMounted(async () => {
  const session = await loadSession()

  if (session.terminals && session.terminals.length > 0) {
    const maxId = Math.max(...session.terminals.map(t => t.id || 0))
    terminalCounter = maxId
    session.terminals.forEach(t => {
      terminals.value.push({
        id: t.id,
        name: t.name || 'nyx terminal',
        cwd: t.cwd
      })
    })

    if (session.layout) {
      layout.value = deserializeLayout(session.layout)
      // Remove orphaned terminals not referenced in layout
      const layoutIds = new Set(getTerminalIdsFromLayout(layout.value))
      terminals.value = terminals.value.filter(t => layoutIds.has(t.id))
    } else {
      // Backward compat: no layout, use first terminal as root leaf
      layout.value = { type: 'leaf', terminalId: session.terminals[0].id }
    }

    activeTerminalId.value = terminals.value[0]?.id || null
  } else {
    addTerminal()
  }

  opacity.value = session.opacity ?? 85
  sessionLoaded = true
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
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
