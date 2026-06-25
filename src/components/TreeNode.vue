<template>
  <div>
    <div 
      class="tree-item" 
      :class="{ 'tree-folder': isFolder, 'tree-file': !isFolder }"
      :style="{ paddingLeft: depth * 16 + 'px' }"
      @click="toggle"
    >
      <span v-if="isFolder" class="tree-toggle">{{ expanded ? '&#9660;' : '&#9654;' }}</span>
      <svg v-if="isFolder" class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
      <svg v-else class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <span class="tree-name">{{ node.name }}</span>
    </div>
    
    <div v-if="isFolder && expanded" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
      />
      <div 
        v-if="node.children.length === 0" 
        class="tree-item tree-empty"
        :style="{ paddingLeft: (depth + 1) * 16 + 'px' }"
      >
        (empty)
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 }
})

const expanded = ref(false)
const isFolder = computed(() => props.node.type === 'dir')

function toggle() {
  if (isFolder.value) {
    expanded.value = !expanded.value
  }
}
</script>

<style scoped>
.tree-item {
  padding: 4px 0;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tree-item:hover {
  color: #fff;
}

.tree-folder {
  color: #60a5fa;
}

.tree-file {
  color: rgba(255, 255, 255, 0.6);
}

.tree-toggle {
  display: inline-block;
  width: 12px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.tree-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-children {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  margin-left: 6px;
}

.tree-empty {
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
}
</style>
