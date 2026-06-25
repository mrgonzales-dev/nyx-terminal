const express = require('express');
const pty = require('node-pty');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');

const app = express();
const server = http.createServer(app);

// Allowed origins for WebSocket connections (prevent CSRF/RCE from other pages)
// Allow any localhost port in dev (Vite may pick 5173, 5174, etc. if port is taken)
const ALLOWED_ORIGINS = [
  'http://localhost:2800',
  'http://127.0.0.1:2800',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]

function isAllowedOrigin(origin) {
  if (!origin) return true  // Non-browser clients may not send origin
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Allow any localhost/127.0.0.1 port — server is bound to 127.0.0.1 so
  // only local connections can reach it anyway. The origin check prevents
  // other local web pages from connecting, but any localhost origin is fine
  // since the server isn't exposed externally.
  try {
    const url = new URL(origin)
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.protocol === 'http:') {
      return true
    }
  } catch (e) {}
  return false
}

// Dynamic port: 0 lets the OS assign an available port (no TOCTOU race)
const wss = new WebSocket.Server({ server });

const CONFIG_DIR = path.join(os.homedir(), '.config', 'nyx');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Load session
function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load session:', err.message);
  }
  return { terminals: [{ id: 1, cwd: os.homedir() }] };
}

// Save session
function saveSession(data) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save session:', err.message);
  }
}

// Serve static files (dist for production, public for assets)
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.use(express.static(publicPath));
app.use(express.json());

// API endpoints for session
app.get('/api/session', (req, res) => {
  res.json(loadSession());
});

app.post('/api/session', (req, res) => {
  saveSession(req.body);
  res.json({ ok: true });
});

// HTTP getcwd endpoint — read cwd from /proc without polluting the PTY
app.get('/api/cwd', (req, res) => {
  const pid = parseInt(req.query.pid, 10);
  if (!pid) {
    return res.status(400).json({ error: 'Missing pid' });
  }
  try {
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    res.json({ cwd });
  } catch (e) {
    res.status(500).json({ error: 'Could not read cwd', cwd: null });
  }
});

// Track active PTY processes for cleanup
const activePtys = new Set();

// Cleanup all PTY processes on exit
function cleanupAllPtys() {
  for (const ptyProcess of activePtys) {
    try {
      ptyProcess.kill();
    } catch (e) {
      // Already dead
    }
  }
  activePtys.clear();
}

process.on('SIGTERM', () => {
  cleanupAllPtys();
  process.exit(0);
});

process.on('SIGINT', () => {
  cleanupAllPtys();
  process.exit(0);
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  // Security: validate origin to prevent cross-site WebSocket hijacking
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }

  console.log('Client connected');

  // Parse cwd from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  let initialCwd = url.searchParams.get('cwd') || os.homedir();

  // Validate cwd exists
  if (!fs.existsSync(initialCwd)) {
    initialCwd = os.homedir();
  }

  // Create PTY
  const shell = process.env.SHELL || 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: initialCwd,
    env: { ...process.env, TERM: 'xterm-256color' }
  });

  activePtys.add(ptyProcess);

  // OSC 7 cwd tracking — inject shell snippet that emits \e]7;file://host/path\a
  // on every directory change. This is what Kitty/WezTerm/VS Code use; works
  // even when a foreground app (htop, nvim) is running because the shell hook
  // fires on prompt/chpwd, not on a query.
  const hostname = os.hostname();
  const osc7Init = `
if [ -n "$BASH_VERSION" ]; then
  __nyx_osc7() { printf '\\e]7;file://${hostname}%s\\a' "$PWD"; }
  PROMPT_COMMAND="__nyx_osc7${'${PROMPT_COMMAND:+;$PROMPT_COMMAND}'}"
elif [ -n "$ZSH_VERSION" ]; then
  __nyx_osc7() { printf '\\e]7;file://${hostname}%s\\a' "$PWD"; }
  chpwd_functions+=(__nyx_osc7)
fi
__nyx_osc7; clear
`;
  ptyProcess.write(osc7Init + '\n');

  let currentCwd = initialCwd;
  let ptyBuffer = '';

  // Send PTY output to WebSocket + parse OSC 7 for cwd tracking
  ptyProcess.on('data', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
    // Parse OSC 7: \x1b]7;file://hostname/path\x07
    ptyBuffer += data.toString('utf8');
    const osc7Regex = /\x1b\]7;file:\/\/[^\/]*([^\x07\x1b]*)\x07/g;
    let match;
    while ((match = osc7Regex.exec(ptyBuffer)) !== null) {
      const p = decodeURIComponent(match[1]);
      if (p) currentCwd = p;
    }
    if (ptyBuffer.length > 256) {
      ptyBuffer = ptyBuffer.slice(-256);
    }
  });

  // Send WebSocket input to PTY
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'resize') {
        ptyProcess.resize(data.cols, data.rows);
      } else if (data.type === 'getcwd') {
        let cwd = currentCwd;
        if (!cwd) {
          try {
            cwd = fs.readlinkSync(`/proc/${ptyProcess.pid}/cwd`);
          } catch (e) {}
        }
        ws.send(JSON.stringify({ type: 'cwd', cwd }));
      }
    } catch (e) {
      // Not JSON, send directly to PTY (raw terminal input)
      ptyProcess.write(msg.toString());
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    activePtys.delete(ptyProcess);
    try {
      ptyProcess.kill();
    } catch (e) {
      // Already dead
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    activePtys.delete(ptyProcess);
    try {
      ptyProcess.kill();
    } catch (e) {
      // Already dead
    }
  });
});

// Start server
// - Electron: port 0 lets the OS pick (no race), parent parses stdout for the port
// - Dev mode (npm run dev): fixed port 2800 so the Vite proxy can route to it
// - Production: port 2800 by default, or override via PORT env
const isElectron = process.env.ELECTRON === 'true'
const PORT = isElectron ? 0 : (process.env.PORT || 2800)
server.listen(PORT, '127.0.0.1', () => {
  const actualPort = server.address().port
  // Print as parseable JSON so the Electron parent process can read it
  console.log(JSON.stringify({ nyx: true, port: actualPort }))
  console.log(`Nyx running at http://localhost:${actualPort}`)
});
