# Nyx

A web-based terminal with Electron desktop app support. Access your real terminal from the browser or as a native desktop application with full filesystem access.

![Sample2](readme_src/sample2.png)

![Sample](readme_src/sample.png)

## Features

- **Real PTY**: Full terminal emulation with node-pty
- **HUD Background**: Dark theme with grid pattern and gradient beams
- **Neon Colors**: Cyan/green color scheme for that techy feel
- **Full Access**: Complete filesystem access from browser
- **Responsive**: Auto-resizes to fit window

## Installation

```bash
cd ~/Projects/nyx-terminal
npm install
```

## Usage

**Web Development:**
```bash
npm run dev
```

**Web Production:**
```bash
npm run build
npm start
```

**Electron Desktop App (Development):**
```bash
npm run electron:dev
```

**Electron Desktop App (Production):**
```bash
npm run electron
```

**Build Electron for Distribution:**
```bash
npm run electron:build
```

For web, open http://localhost:2800 in your browser (or check the console for the actual port if 2800 is in use).

## Customization

Edit `src/App.vue` to customize:
- Background colors and gradients
- Grid pattern
- Terminal colors (xterm theme)
- HUD header styling

Edit `electron/main.js` to customize Electron settings:
- Window size and behavior
- Menu configuration
- Native integrations

## Security

**Warning**: The web version gives full terminal access to anyone who can access the URL. Use behind a firewall or add authentication for production use.

The Electron desktop app runs locally and is not exposed to the network.

## Tech Stack

- **Backend**: Node.js + Express + node-pty + WebSocket
- **Frontend**: Vue 3 + Vite + @xterm/xterm
- **Desktop**: Electron + electron-builder
- **Styling**: CSS with gradients and grid patterns
