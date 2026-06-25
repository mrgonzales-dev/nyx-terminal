const express = require('express');
const pty = require('node-pty');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const net = require('net');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DEFAULT_PORT = 2800;

// Find an available port starting from the default
function getAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', () => {
      // Port is in use, try the next one
      server.close(() => {
        getAvailablePort(startPort + 1).then(resolve);
      });
    });
  });
}

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

// Get directory tree
function getTree(dirPath, depth = 0, maxDepth = 2) {
  const items = [];
  const resolvedPath = dirPath.replace(/^~/, os.homedir());
  
  try {
    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    
    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      // Skip hidden files and common noise
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      const fullPath = path.join(resolvedPath, entry.name);
      items.push({
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'dir' : 'file',
        depth
      });

      // Recurse into directories
      if (entry.isDirectory() && depth < maxDepth) {
        items.push(...getTree(fullPath, depth + 1, maxDepth));
      }
    }
  } catch (err) {
    // Permission denied or other error
  }

  return items;
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('Client connected');

  // Parse cwd from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  let initialCwd = url.searchParams.get('cwd') || process.env.HOME;
  
  // Validate cwd exists
  if (!fs.existsSync(initialCwd)) {
    initialCwd = process.env.HOME;
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

  // Track current working directory
  let currentCwd = initialCwd;

  // Send PTY output to WebSocket
  ptyProcess.on('data', (data) => {
    ws.send(data);
  });

  // Send WebSocket input to PTY
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'resize') {
        ptyProcess.resize(data.cols, data.rows);
      } else if (data.type === 'tree') {
        const treePath = data.path || process.env.HOME;
        const items = getTree(treePath);
        ws.send(JSON.stringify({ type: 'tree', path: treePath, items }));
      } else if (data.type === 'getcwd') {
        // Get current working directory from shell
        ptyProcess.write('pwd\r');
      } else {
        ptyProcess.write(msg.toString());
      }
    } catch (e) {
      // Not JSON, send directly to PTY
      ptyProcess.write(msg.toString());
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    ptyProcess.kill();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    ptyProcess.kill();
  });
});

// Start server with dynamic port selection
getAvailablePort(DEFAULT_PORT).then((port) => {
  server.listen(port, () => {
    console.log(`Nyx running at http://localhost:${port}`);
  });
});
