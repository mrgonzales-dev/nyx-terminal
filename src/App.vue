<template>
  <Banner :opacity="opacity" @update:opacity="opacity = $event" />
  <main class="main-content">
    <div class="terminals-area">
      <ResizablePanels 
        :items="terminals" 
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
const terminalRefs = ref({})
// Use a persistent counter that won't reset on remount or collide with saved IDs
let terminalCounter = 0

function setTerminalRef(id, el) {
  if (el) {
    terminalRefs.value[id] = el
  } else {
    delete terminalRefs.value[id]
  }
}

// Debounced resize handler — avoids flooding xterm fit() on every mousemove
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
  terminals.value.push({
    id: ++terminalCounter,
    name: name || `Terminal ${terminalCounter}`,
    cwd
  })
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
  }
}

function renameTerminal(id, name) {
  const term = terminals.value.find(t => t.id === id)
  if (term) {
    term.name = name
  }
}

async function saveSession() {
  await save({
    terminals: terminals.value.map(t => ({ id: t.id, name: t.name, cwd: t.cwd })),
    treeOpen: treeOpen.value,
    opacity: opacity.value
  })
}

// Debounced auto-save — only fires when state actually changes, not on a timer
let saveTimer = null
let sessionLoaded = false
function scheduleSave() {
  if (!sessionLoaded) return  // Don't save before initial load completes
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSession, 1000)
}

// Watch for state changes and debounce-save
watch([terminals, treeOpen, opacity], scheduleSave, { deep: true })

onMounted(async () => {
  const session = await loadSession()

  // Seed terminalCounter from saved session to avoid ID collisions
  if (session.terminals && session.terminals.length > 0) {
    const maxId = Math.max(...session.terminals.map(t => t.id || 0))
    terminalCounter = maxId
    session.terminals.forEach(t => addTerminal(t.cwd, t.name))
  } else {
    addTerminal()
  }

  treeOpen.value = session.treeOpen || false
  opacity.value = session.opacity ?? 85
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
