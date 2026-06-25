<template>
  <div class="terminal-container" @click="focusTerminal">
    <div class="terminal-header">
      <span class="terminal-title">Terminal {{ id }}</span>
      <button 
        v-if="canClose" 
        class="terminal-close" 
        @click.stop="$emit('close', id)"
      >
        &times;
      </button>
    </div>
    <div class="terminal-wrapper" ref="terminalRef"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

const props = defineProps({
  id: { type: Number, required: true },
  cwd: { type: String, default: null },
  canClose: { type: Boolean, default: true }
})

const emit = defineEmits(['close'])

const terminalRef = ref(null)
let term = null
let fitAddon = null
let ws = null

const terminalConfig = {
  theme: {
    background: 'transparent',
    foreground: '#e4e4e7',
    cursor: '#a78bfa',
    cursorAccent: '#0a0a0f',
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
  fontWeight: '400',
  fontWeightBold: '600',
  letterSpacing: 0,
  lineHeight: 1.4,
  cursorBlink: true,
  cursorStyle: 'bar',
  cursorWidth: 2,
  allowTransparency: true,
  scrollback: 10000,
  smoothScrollDuration: 100
}

function focusTerminal() {
  term?.focus()
}

function fit() {
  try {
    fitAddon?.fit()
  } catch (e) {}
}

onMounted(() => {
  term = new Terminal(terminalConfig)
  fitAddon = new FitAddon()
  const webLinksAddon = new WebLinksAddon()

  term.loadAddon(fitAddon)
  term.loadAddon(webLinksAddon)
  term.open(terminalRef.value)

  // WebSocket connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = props.cwd
    ? `${protocol}//${window.location.host}?cwd=${encodeURIComponent(props.cwd)}`
    : `${protocol}//${window.location.host}`
  
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    const dims = fitAddon.proposeDimensions()
    if (dims) {
      ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
    }
  }

  ws.onmessage = (event) => {
    term.write(event.data)
  }

  ws.onerror = () => ws.close()

  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  setTimeout(fit, 50)
  window.addEventListener('resize', fit)
  term.focus()
})

onUnmounted(() => {
  window.removeEventListener('resize', fit)
  ws?.close()
  term?.dispose()
})
</script>

<style scoped>
.terminal-container {
  flex: 1;
  position: relative;
  background: rgba(10, 10, 15, 0.85);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 20px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 300px;
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
}
</style>
