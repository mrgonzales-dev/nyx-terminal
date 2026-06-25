<template>
  <Banner />
  <main class="main-content">
    <div class="terminals-area">
      <TerminalPane
        v-for="term in terminals"
        :key="term.id"
        :id="term.id"
        :cwd="term.cwd"
        :canClose="terminals.length > 1"
        @close="closeTerminal"
      />
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
import { ref, onMounted, watch } from 'vue'
import Banner from './components/Banner.vue'
import TerminalPane from './components/TerminalPane.vue'
import TreePanel from './components/TreePanel.vue'
import FooterBar from './components/FooterBar.vue'
import { useSession } from './composables/useSession'

const { loadSession, saveSession: save } = useSession()

const terminals = ref([])
const treeOpen = ref(false)
let terminalCounter = 0

function addTerminal(cwd = null) {
  terminals.value.push({
    id: ++terminalCounter,
    cwd
  })
}

function closeTerminal(id) {
  if (terminals.value.length <= 1) return
  const index = terminals.value.findIndex(t => t.id === id)
  if (index !== -1) {
    terminals.value.splice(index, 1)
  }
}

async function saveSession() {
  await save({
    terminals: terminals.value.map(t => ({ id: t.id, cwd: t.cwd })),
    treeOpen: treeOpen.value
  })
}

// Auto-save every 5 seconds
setInterval(saveSession, 5000)

onMounted(async () => {
  const session = await loadSession()
  
  if (session.terminals && session.terminals.length > 0) {
    session.terminals.forEach(t => addTerminal(t.cwd))
  } else {
    addTerminal()
  }
  
  treeOpen.value = session.treeOpen || false
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
  gap: 16px;
  min-width: 0;
}
</style>
