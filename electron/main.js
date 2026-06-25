const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let tray = null
let serverProcess = null
let serverPort = null
let isQuitting = false

const isDev = process.env.NODE_ENV === 'development'

// Generate a tray icon from the SVG favicon (Electron Tray needs PNG/native image)
function createTrayIcon() {
  const iconPath = path.join(__dirname, '..', 'public', 'assets', 'favicon.svg')
  try {
    // nativeImage can load some SVGs on macOS; on Linux/Win it may fail.
    // Use resize to get a proper 22x22 tray icon size.
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      // Fallback: create a 1x1 transparent image so Tray doesn't crash
      const fallback = nativeImage.createEmpty()
      return fallback
    }
    return icon.resize({ width: 22, height: 22 })
  } catch (e) {
    console.warn('Failed to load tray icon, using empty image:', e.message)
    return nativeImage.createEmpty()
  }
}

function startServer() {
  // Don't start a second server if one is already running
  if (serverProcess && !serverProcess.killed) {
    return Promise.resolve(serverPort)
  }

  const serverPath = path.join(__dirname, '..', 'server.js')
  serverProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ELECTRON: 'true' },
    detached: false
  })

  return new Promise((resolve, reject) => {
    let resolved = false

    // Parse the port from server stdout (server prints JSON: {"nyx":true,"port":XXXX})
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log(`Server: ${output}`)

      if (resolved) return

      // Look for the JSON port line
      const match = output.match(/\{"nyx":\s*true,\s*"port":\s*(\d+)\}/)
      if (match) {
        resolved = true
        serverPort = parseInt(match[1], 10)
        console.log(`Server ready on port ${serverPort}`)
        resolve(serverPort)
      }
    })

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server error: ${data}`)
    })

    serverProcess.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Failed to start server: ${err.message}`))
      }
    })

    serverProcess.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Server exited with code ${code} before reporting port`))
      }
    })

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('Server failed to start within 10 seconds'))
      }
    }, 10000)
  })
}

function createWindow(port) {
  // Reuse existing window if it exists
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    return
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Nyx',
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '..', 'public', 'assets', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}`)

  // Hide menu bar
  mainWindow.setMenuBarVisibility(false)

  // Minimize to tray on close instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
    // When actually quitting, don't set mainWindow to null here —
    // let the 'closed' event handle it (fires after preventDefault is not called)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC handler for "New Terminal" from tray menu
ipcMain.on('nyx:add-terminal', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.executeJavaScript('window.nyxAddTerminal && window.nyxAddTerminal()')
  }
})

function createTray() {
  const icon = createTrayIcon()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Nyx',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'New Terminal',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.executeJavaScript('window.nyxAddTerminal && window.nyxAddTerminal()')
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray = new Tray(icon)
  tray.setToolTip('Nyx Terminal')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    }
  })
}

app.whenReady().then(async () => {
  try {
    const port = await startServer()
    createWindow(port)
    createTray()
  } catch (err) {
    console.error('Failed to start Nyx:', err.message)
    app.quit()
  }

  app.on('activate', () => {
    // Guard against spawning a second server — reuse existing if available
    if (serverProcess && !serverProcess.killed && serverPort) {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(serverPort)
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    } else if (BrowserWindow.getAllWindows().length === 0) {
      startServer().then((port) => createWindow(port)).catch(console.error)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  if (serverProcess) {
    try {
      // Kill the server process; server.js handles cleaning up PTY children
      // via its SIGTERM handler
      serverProcess.kill('SIGTERM')
    } catch (e) {
      // Already dead
    }
  }
})
