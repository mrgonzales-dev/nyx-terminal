# File Tree — Set Aside

The file tree feature was removed from the live system on 2026-06-25 and stored
here for potential future re-integration. Nothing in here is imported or served
by the running app.

---

## What the feature did

A 280px sidebar (`TreePanel.vue`) that rendered a recursive file/folder tree
(`TreeNode.vue`) of the user's home directory. Data came from a `GET /api/tree`
HTTP endpoint in `server.js` (with a legacy WS `tree` message handler for
backward compat). Folders expanded/collapsed on click. Files did nothing — no
path insert, no copy, no drag. It was display-only.

A toggle button ("Files") in `FooterBar.vue` opened/closed the panel, and the
open/closed state was persisted in `session.json` as `treeOpen`.

---

## Files moved here (original paths)

| File                          | Original path                      |
|-------------------------------|------------------------------------|
| `TreePanel.vue`               | `src/components/TreePanel.vue`     |
| `TreeNode.vue`                | `src/components/TreeNode.vue`      |
| `tree-endpoint.js`            | extracted from `server.js` (lines 91-153 + WS handler) |

`tree-endpoint.js` is not a drop-in module — it's the raw code extracted from
`server.js` with re-integration instructions in its header comment. Paste the
pieces back into `server.js` to restore the endpoint.

---

## What was removed from live files

### `server.js`
- `app.get('/api/tree', ...)` route (HTTP endpoint)
- `function getTree(dirPath, depth, maxDepth)` helper
- `else if (data.type === 'tree')` branch inside the WS `message` handler

### `src/App.vue`
- `import TreePanel from './components/TreePanel.vue'`
- `const treeOpen = ref(false)`
- `<TreePanel v-if="treeOpen" @close="treeOpen = false" />` template block
- `:treeOpen="treeOpen"` and `@toggle-tree="treeOpen = !treeOpen"` bindings on `<FooterBar>`
- `treeOpen: treeOpen.value` in `saveSession()`
- `treeOpen` in the `watch([...], scheduleSave)` array
- `treeOpen.value = session.treeOpen || false` in `onMounted`

### `src/components/FooterBar.vue`
- The "Files" toggle button (template + SVG)
- `defineProps({ treeOpen: ... })`
- `'toggle-tree'` from `defineEmits`

### `src/composables/useSession.js`
- `treeOpen: false` from the error-fallback session object

---

## Files checked and left untouched

- `src/components/Banner.vue` — no tree references
- `src/components/Settings.vue` — no tree references (nyx's file, not touched)
- `vite.config.js` — no tree-specific proxy (the `/api` proxy is generic and stays)
- `electron/main.js` — no tree-specific IPC
- `src/components/TerminalPane.vue` — no tree references
- `src/components/ResizablePanels.vue` — no tree references
- `src/components/SplitButton.vue` — no tree references

---

## Session compatibility

Old `session.json` files may still contain `"treeOpen": true`. The app now
ignores this field — `loadSession()` returns whatever is in the file, and
`App.vue` no longer reads `session.treeOpen`. No crash, no warning. The field
will be dropped on the next save since `saveSession()` no longer writes it.

---

## How to re-integrate later

1. **Server:** Open `setAsides/fileTree/tree-endpoint.js` and follow the
   header-comment instructions — paste the `getTree()` function and the
   `app.get('/api/tree', ...)` route back into `server.js` (after the session
   routes, before the PTY tracking section). Optionally paste the WS `tree`
   branch back into the `ws.on('message')` handler for backward compat.

2. **Components:** Move `TreePanel.vue` and `TreeNode.vue` back to
   `src/components/`.

3. **App.vue:** Re-add the `TreePanel` import, the `treeOpen` ref, the
   `<TreePanel>` template block, the `treeOpen` prop + `@toggle-tree` binding
   on `<FooterBar>`, the `treeOpen` field in `saveSession()`, the `treeOpen`
   in the `watch()` array, and `treeOpen.value = session.treeOpen || false`
   in `onMounted`.

4. **FooterBar.vue:** Re-add the "Files" button, the `treeOpen` prop, and
   `'toggle-tree'` to `defineEmits`.

5. **useSession.js:** Re-add `treeOpen: false` to the fallback if desired
   (optional — the app tolerates a missing field).

---

## Enhancement ideas (from Lorraine/Nina's research)

See `docs/proposals/file-tree-future.md` for the full proposal. Summary of the
ranked options to consider before re-integrating:

- **A. Click-to-insert path** (highest impact, ~20 lines) — clicking a file
  inserts its path into the active terminal's input line. This is the killer
  feature that justifies the panel's existence.
- **B. Copy path to clipboard** — right-click or button copies the absolute
  path. Nearly free once the path is accessible; pair with A.
- **C. Drag file into terminal** — HTML5 drag-and-drop inserts path at cursor.
  Same outcome as A, different input method. Skip unless A proves popular.
- **D. Quick file actions (rename/delete/new)** — **rejected.** IDE territory;
  the terminal is already the file manager. Invites scope creep.
- **E. File search/filter** — useful but not essential; `fzf`/`find` already
  exist in the terminal. Maybe later.

**Recommendation if re-integrating:** ship A + B only. Stop there. The tree's
job is to feed the terminal, not replace the filesystem.
