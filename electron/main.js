const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let tray = null
let serverProcess = null

const DEFAULT_PORT = 2400
const isDev = process.env.NODE_ENV === 'development'

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server.js')
  serverProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ELECTRON: 'true' }
  })

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`)
  })

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server error: ${data}`)
  })

  return new Promise((resolve, reject) => {
    let actualPort = DEFAULT_PORT

    // Poll to find the actual port the server is running on
    const checkServer = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${actualPort}`)
        if (response.ok) {
          clearInterval(checkServer)
          console.log(`Server ready on port ${actualPort}`)
          resolve(actualPort)
        }
      } catch (e) {
        // Try next port if current one fails
        actualPort++
        if (actualPort > DEFAULT_PORT + 100) {
          clearInterval(checkServer)
          reject(new Error('Could not find available port'))
        }
      }
    }, 100)

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkServer)
      reject(new Error('Server failed to start within 10 seconds'))
    }, 10000)
  })
}

function createWindow(port) {
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
    },
    frame: true,
    titleBarStyle: 'default'
  })

  mainWindow.loadURL(`http://localhost:${port}`)

  // Hide menu bar
  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Minimize to tray on close (optional)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  // Create a simple tray icon
  const iconPath = path.join(__dirname, '..', 'public', 'assets', 'favicon.svg')
  tray = new Tray(iconPath)
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show Nyx', 
      click: () => mainWindow.show() 
    },
    { type: 'separator' },
    { 
      label: 'New Terminal',
      click: () => {
        mainWindow.show()
        mainWindow.webContents.executeJavaScript('window.addTerminal && window.addTerminal()')
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('Nyx Terminal')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
}

app.whenReady().then(async () => {
  const port = await startServer()
  createWindow(port)
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startServer().then((port) => createWindow(port))
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (serverProcess) {
    serverProcess.kill()
  }
})
