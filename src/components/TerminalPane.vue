<template>
  <div class="terminal-container" :class="{ active: isActive }" @click="focusTerminal" @contextmenu="onContextMenu">
    <div class="terminal-header" @click.stop="$emit('focus', id)">
      <input
        class="terminal-title"
        :value="name"
        @input="$emit('rename', id, $event.target.value)"
        @click.stop
        @focus="editing = true"
        @blur="editing = false"
        spellcheck="false"
      />
      <div class="terminal-actions">
        <SplitButton :disabled="maxReached" @split="$emit('split', id, $event)" />
        <button
          v-if="canClose"
          class="terminal-close"
          @click.stop="$emit('close', id)"
        >
          &times;
        </button>
      </div>
    </div>
    <div class="terminal-wrapper" ref="terminalRef" @click="focusTerminal"></div>
    <div v-if="disconnected" class="terminal-disconnected">
      <span>Disconnected</span>
      <button class="reconnect-btn" @click.stop="reconnect">Reconnect</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import SplitButton from './SplitButton.vue'
import 'xterm/css/xterm.css'

const props = defineProps({
  id: { type: Number, required: true },
  name: { type: String, default: '' },
  canClose: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false },
  maxReached: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'rename', 'split', 'focus'])

const terminalRef = ref(null)
const disconnected = ref(false)
const editing = ref(false)
let term = null
let fitAddon = null
let ws = null
let reconnectAttempts = 0
let reconnectTimer = null
let disposed = false
let clipboardWriteTimer = null
let lastClipboardText = ''
let cursorInterval = null

const terminalConfig = {
  theme: {
    background: 'transparent',
    foreground: '#e4e4e7',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(167, 139, 250, 0.3)',
    selectionForeground: '#ffffff',
    black: '#18181b',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#e4e4e7',
    brightBlack: '#52525b',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde047',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f9',
    brightWhite: '#fafafa'
  },
  fontFamily: '"JetBrainsMono Nerd Font", "Fira Code", "JetBrains Mono", monospace',
  fontSize: 14,
  fontWeight: '600',
  fontWeightBold: '900',
  letterSpacing: 0,
  lineHeight: 1.4,
  cursorBlink: false,
  cursorStyle: 'block',
  cursorWidth: 20,
  allowTransparency: true,
  scrollback: 10000,
  smoothScrollDuration: 100
}

function focusTerminal() {
  emit('focus', props.id)
  term?.focus()
}

// Right-click: copy if selection, paste if no selection
function onContextMenu(e) {
  e.preventDefault()
  e.stopPropagation()
  if (term && term.hasSelection()) {
    const selection = term.getSelection()
    if (selection && selection !== lastClipboardText) {
      lastClipboardText = selection
      navigator.clipboard.writeText(selection).catch(() => {})
    }
    term.clearSelection()
  } else if (term) {
    navigator.clipboard.readText().then((text) => {
      if (text) term.paste(text)
    }).catch(() => {})
  }
}

function fit() {
  try {
    fitAddon?.fit()
  } catch (e) {
    console.warn('Failed to fit terminal:', e)
  }
}

function buildWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const base = `${protocol}//${window.location.host}/ws`
  return base
}

function connectWs() {
  ws = new WebSocket(buildWsUrl())

  ws.onopen = () => {
    disconnected.value = false
    reconnectAttempts = 0
    const dims = fitAddon.proposeDimensions()
    if (dims) {
      ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
    }
  }

  ws.onmessage = (event) => {
    // Check for OSC 52 clipboard sequences from tmux
    // Actual format from tmux: ]52;;<base64_data> (no \x1b prefix, no \x07 suffix, empty selector)
    const osc52Match = event.data.match(/\]52;;([^\x07\x1b]+)/)
    if (osc52Match) {
      try {
        const base64Data = osc52Match[1]
        const text = atob(base64Data)
        // Only write if text is non-empty, not just whitespace, and different from last write
        if (text && text.trim() && text !== lastClipboardText) {
          lastClipboardText = text
          // Debounce clipboard writes to prevent duplicates from tmux
          if (clipboardWriteTimer) clearTimeout(clipboardWriteTimer)
          clipboardWriteTimer = setTimeout(() => {
            navigator.clipboard.writeText(text).catch(() => {})
          }, 100) // 100ms debounce
        }
      } catch (e) {
        // Invalid base64, ignore
      }
      return // Don't write OSC 52 to terminal
    }
    term.write(event.data)
  }

  ws.onerror = (err) => {
    console.error('Terminal WebSocket error:', err)
  }

  ws.onclose = () => {
    if (disposed) return
    disconnected.value = true
    // Auto-reconnect with exponential backoff (max 30s)
    if (reconnectAttempts < 10) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
      reconnectAttempts++
      reconnectTimer = setTimeout(() => {
        if (!disposed) connectWs()
      }, delay)
    }
  }
}

function reconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempts = 0
  if (ws) {
    try { ws.close() } catch (e) {}
  }
  connectWs()
}

// Expose fit to parent
defineExpose({ fit })

onMounted(() => {
  term = new Terminal(terminalConfig)
  fitAddon = new FitAddon()
  const webLinksAddon = new WebLinksAddon()

  term.loadAddon(fitAddon)
  term.loadAddon(webLinksAddon)
  term.open(terminalRef.value)

  // Force block cursor with bright color for nvim compatibility
  term.options.cursorStyle = 'block'
  term.options.cursorWidth = 2
  term.options.cursorBlink = false // Disable blink to ensure visibility

  // Force cursor class to block (nvim compatibility)
  const forceBlockCursor = () => {
    const cursor = terminalRef.value?.querySelector('.xterm-cursor')
    if (cursor) {
      cursor.classList.remove('xterm-cursor-outline', 'xterm-cursor-bar', 'xterm-cursor-underline')
      cursor.classList.add('xterm-cursor-block')
      cursor.style.width = 'auto'
      cursor.style.minWidth = '8px'
      cursor.style.maxWidth = '8px'
      cursor.style.height = '14px'
      cursor.style.backgroundColor = '#ffffff'
    }
  }
  // Force immediately and then periodically
  forceBlockCursor()
  cursorInterval = setInterval(forceBlockCursor, 100)

  // Focus terminal on mousedown — xterm canvas swallows click events
  terminalRef.value.addEventListener('mousedown', () => {
    emit('focus', props.id)
  })

  connectWs()

  term.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  term.onResize(({ cols, rows }) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  setTimeout(fit, 50)
  window.addEventListener('resize', fit)
  term.focus()
})

onUnmounted(() => {
  disposed = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  window.removeEventListener('resize', fit)
  if (ws) {
    try { ws.close() } catch (e) {}
  }
  term?.dispose()
  // Clear cursor intervals
  if (cursorInterval) clearInterval(cursorInterval)
})
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: rgba(10, 10, 15, var(--terminal-opacity, 0.85));
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 20px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex-shrink: 1;
  flex-grow: 1;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.terminal-container.active {
  border-color: rgba(255, 255, 255, 0.7);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.2),
    0 0 20px rgba(167, 139, 250, 0.3),
    0 20px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.terminal-header {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.terminal-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 6px;
  outline: none;
  cursor: text;
  transition: all 0.15s ease;
  font-family: 'JetBrainsMono Nerd Font', monospace;
  max-width: 200px;
}

.terminal-title:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.terminal-title:focus {
  color: #c4b5fd;
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.4);
}

.terminal-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.terminal-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.terminal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f87171;
}

.terminal-wrapper {
  flex: 1;
  margin: 12px;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.terminal-disconnected {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(248, 113, 113, 0.15);
  border: 1px solid rgba(248, 113, 113, 0.4);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  z-index: 10;
  backdrop-filter: blur(8px);
}

.reconnect-btn {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.5);
  border-radius: 4px;
  color: #fca5a5;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reconnect-btn:hover {
  background: rgba(248, 113, 113, 0.3);
  color: #fff;
}
</style>
