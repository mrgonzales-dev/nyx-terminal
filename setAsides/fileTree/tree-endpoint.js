// Extracted from server.js when the file tree feature was set aside.
// Original location: server.js lines 91-153 (the /api/tree endpoint + getTree helper)
// and the WS 'tree' message handler in the wss.on('connection') block.
//
// To re-integrate:
//   1. Paste the getTree() function and the app.get('/api/tree', ...) route back
//      into server.js (after the session routes, before the PTY tracking section).
//   2. Paste the `else if (data.type === 'tree')` branch back into the
//      ws.on('message') handler.
//   3. Requires: express, path, fs, os — all already imported by server.js.

// ---------------------------------------------------------------------------
// HTTP route (paste after the /api/session POST route in server.js)
// ---------------------------------------------------------------------------

// Get directory tree via HTTP (no PTY needed — fixes H4 process leak)
app.get('/api/tree', (req, res) => {
  const requestedPath = req.query.path || os.homedir();
  const resolvedPath = path.resolve(requestedPath.replace(/^~/, os.homedir()));

  // Security: prevent path traversal outside allowed roots
  const homeDir = os.homedir();
  const isAllowed = resolvedPath === homeDir ||
    resolvedPath.startsWith(homeDir + path.sep) ||
    resolvedPath === '/' ||
    resolvedPath.startsWith('/tmp' + path.sep);

  if (!isAllowed) {
    return res.status(403).json({ error: 'Access denied: path outside allowed root' });
  }

  try {
    const items = getTree(resolvedPath);
    res.json({ path: resolvedPath, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get directory tree (internal function)
function getTree(dirPath, depth = 0, maxDepth = 2) {
  const items = [];
  const resolvedPath = path.resolve(dirPath);

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
    // Re-throw so the HTTP handler can send the error to the client
    throw err;
  }

  return items;
}

// ---------------------------------------------------------------------------
// WebSocket handler (paste inside ws.on('message', ...) in the connection block)
// ---------------------------------------------------------------------------

// } else if (data.type === 'tree') {
//   // Tree requests should use the HTTP /api/tree endpoint now.
//   // Keep backward compat but don't spawn anything new.
//   const treePath = data.path || os.homedir();
//   try {
//     const items = getTree(treePath);
//     if (ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify({ type: 'tree', path: treePath, items }));
//     }
//   } catch (err) {
//     if (ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify({ type: 'tree', error: err.message }));
//     }
//   }
// }
