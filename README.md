# Nyx

A web-based terminal. Access your real terminal from the browser with full filesystem access.

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

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

Then open http://localhost:3000 in your browser.

## Customization

Edit `src/App.vue` to customize:
- Background colors and gradients
- Grid pattern
- Terminal colors (xterm theme)
- HUD header styling

## Security

**Warning**: This gives full terminal access to anyone who can access the URL. Use behind a firewall or add authentication for production use.

## Tech Stack

- **Backend**: Node.js + Express + node-pty + WebSocket
- **Frontend**: Vue 3 + Vite + @xterm/xterm
- **Styling**: CSS with gradients and grid patterns
