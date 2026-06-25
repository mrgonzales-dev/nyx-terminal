const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let tray = null
let serverProcess = null

const PORT = 3000
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

  return new Promise((resolve) => {
    // Wait for server to be ready
    const checkServer = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${PORT}`)
        if (response.ok) {
          clearInterval(checkServer)
          resolve()
        }
      } catch (e) {
        // Server not ready yet
      }
    }, 100)
  })
}

function createWindow() {
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

  mainWindow.loadURL(`http://localhost:${PORT}`)

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
  await startServer()
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
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
