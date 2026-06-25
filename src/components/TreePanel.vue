<template>
  <aside class="tree-panel">
    <div class="tree-header">
      <h2>Files</h2>
      <div class="tree-actions">
        <button class="tree-home" title="Home" @click="loadTree('~')">~</button>
        <button class="tree-close" @click="$emit('close')">&times;</button>
      </div>
    </div>
    <div class="tree-content">
      <TreeNode
        v-for="node in tree"
        :key="node.path"
        :node="node"
        :depth="0"
      />
      <div v-if="loading" class="tree-loading">Loading...</div>
      <div v-else-if="tree.length === 0" class="tree-empty">No files</div>
    </div>
  </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TreeNode from './TreeNode.vue'

const emit = defineEmits(['close'])

const tree = ref([])
const loading = ref(true)
let ws = null

function buildTree(items) {
  const root = []
  const map = {}

  items.forEach(item => {
    map[item.path] = { ...item, children: [] }
  })

  items.forEach(item => {
    const node = map[item.path]
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/'))
    if (map[parentPath]) {
      map[parentPath].children.push(node)
    } else {
      root.push(node)
    }
  })

  return root
}

function loadTree(path = '~') {
  loading.value = true
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'tree', path }))
  }
}

onMounted(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}`)

  ws.onopen = () => {
    loadTree('~')
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'tree') {
        tree.value = buildTree(data.items || [])
        loading.value = false
      }
    } catch (e) {}
  }
})
</script>

<style scoped>
.tree-panel {
  width: 280px;
  background: rgba(10, 10, 15, 0.85);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tree-header h2 {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tree-actions {
  display: flex;
  gap: 8px;
}

.tree-home,
.tree-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.tree-home:hover,
.tree-close:hover {
  color: #fff;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-family: 'JetBrainsMono Nerd Font', 'Fira Code', monospace;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.tree-content::-webkit-scrollbar {
  width: 6px;
}

.tree-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.tree-loading,
.tree-empty {
  color: rgba(255, 255, 255, 0.4);
}
</style>
