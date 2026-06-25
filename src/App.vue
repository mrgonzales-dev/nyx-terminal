<template>
  <Banner :opacity="opacity" @update:opacity="opacity = $event" />
  <main class="main-content">
    <div class="terminals-area">
      <ResizablePanels
        :items="terminals"
        :direction="splitDirection"
        @resize="onPanelsResize"
      >
        <template #default="{ item }">
          <TerminalPane
            :id="item.id"
            :name="item.name"
            :cwd="item.cwd"
            :canClose="terminals.length > 1"
            :ref="el => setTerminalRef(item.id, el)"
            @close="closeTerminal"
            @rename="renameTerminal"
            @split="splitTerminal"
            @focus="setActiveTerminal"
          />
        </template>
      </ResizablePanels>
    </div>
    <TreePanel
      v-if="treeOpen"
      @close="treeOpen = false"
    />
  </main>
  <FooterBar
    :treeOpen="treeOpen"
    @toggle-tree="treeOpen = !treeOpen"
    @add-terminal="addTerminal"
    @split="splitActiveTerminal"
    @save="saveSession"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Banner from './components/Banner.vue'
import TerminalPane from './components/TerminalPane.vue'
import TreePanel from './components/TreePanel.vue'
import FooterBar from './components/FooterBar.vue'
import ResizablePanels from './components/ResizablePanels.vue'
import { useSession } from './composables/useSession'

const { loadSession, saveSession: save } = useSession()

const terminals = ref([])
const treeOpen = ref(false)
const opacity = ref(85)
const splitDirection = ref('horizontal')  // 'horizontal' or 'vertical'
const activeTerminalId = ref(null)
const terminalRefs = ref({})
let terminalCounter = 0

function setTerminalRef(id, el) {
  if (el) {
    terminalRefs.value[id] = el
  } else {
    delete terminalRefs.value[id]
  }
}

// Debounced resize handler
let resizeTimer = null
function onPanelsResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    Object.values(terminalRefs.value).forEach(ref => {
      if (ref && ref.fit) {
        ref.fit()
      }
    })
  }, 50)
}

function addTerminal(cwd = null, name = null) {
  const id = ++terminalCounter
  terminals.value.push({
    id,
    name: name || `Terminal ${terminalCounter}`,
    cwd
  })
  activeTerminalId.value = id
}

// Expose addTerminal to window for Electron tray menu integration
if (typeof window !== 'undefined') {
  window.nyxAddTerminal = addTerminal
}

function closeTerminal(id) {
  if (terminals.value.length <= 1) return
  const index = terminals.value.findIndex(t => t.id === id)
  if (index !== -1) {
    terminals.value.splice(index, 1)
    // Update active terminal if we closed the active one
    if (activeTerminalId.value === id) {
      activeTerminalId.value = terminals.value[0]?.id || null
    }
  }
}

function renameTerminal(id, name) {
  const term = terminals.value.find(t => t.id === id)
  if (term) {
    term.name = name
  }
}

function setActiveTerminal(id) {
  activeTerminalId.value = id
}

// Split the active terminal in the given direction
function splitActiveTerminal(direction) {
  if (!activeTerminalId.value) {
    // No active terminal — just add a new one
    splitDirection.value = direction
    addTerminal()
    return
  }
  splitDirection.value = direction
  // Add new terminal next to the active one
  const activeIndex = terminals.value.findIndex(t => t.id === activeTerminalId.value)
  const newId = ++terminalCounter
  const newTerm = {
    id: newId,
    name: `Terminal ${terminalCounter}`,
    cwd: null
  }
  if (activeIndex !== -1) {
    terminals.value.splice(activeIndex + 1, 0, newTerm)
  } else {
    terminals.value.push(newTerm)
  }
  activeTerminalId.value = newId
}

// Split a specific terminal (from TerminalPane header)
function splitTerminal(id, direction) {
  activeTerminalId.value = id
  splitActiveTerminal(direction)
}

async function saveSession() {
  await save({
    terminals: terminals.value.map(t => ({ id: t.id, name: t.name, cwd: t.cwd })),
    treeOpen: treeOpen.value,
    opacity: opacity.value,
    splitDirection: splitDirection.value
  })
}

// Debounced auto-save
let saveTimer = null
let sessionLoaded = false
function scheduleSave() {
  if (!sessionLoaded) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSession, 1000)
}

watch([terminals, treeOpen, opacity, splitDirection], scheduleSave, { deep: true })

onMounted(async () => {
  const session = await loadSession()

  if (session.terminals && session.terminals.length > 0) {
    const maxId = Math.max(...session.terminals.map(t => t.id || 0))
    terminalCounter = maxId
    session.terminals.forEach(t => addTerminal(t.cwd, t.name))
  } else {
    addTerminal()
  }

  treeOpen.value = session.treeOpen || false
  opacity.value = session.opacity ?? 85
  splitDirection.value = session.splitDirection || 'horizontal'
  sessionLoaded = true
})

onUnmounted(() => {
  if (resizeTimer) clearTimeout(resizeTimer)
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
}

.terminals-area {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
}
</style>
