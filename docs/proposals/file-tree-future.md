# Proposal: The File Tree — Enhance or Remove?

**Status:** Draft · **Author:** Nina · **Date:** 2026-06-25
**Decision needed from:** MR. G

---

## 1. The Problem

The file tree currently does one thing well — **shows** files and folders. That's it. Clicking a folder expands it. Clicking a file does nothing. There's no path to copy, no drag to terminal, no action to take.

A panel that only *displays* information a developer could get from `ls` is dead weight. It occupies 280px of screen real estate and returns zero actionable value. Every time someone opens it, they think "what am I supposed to do with this?" and close it. That's the worst outcome for a UI element — it exists, it teases utility, and it disappoints.

The core issue: **the tree has no bridge to the terminal**, which is the actual point of this app.

---

## 2. Enhancement Options (ranked by impact-to-effort)

### A. Click-to-insert path — ⭐ Highest impact, lowest effort
- **What:** Clicking a file inserts its path into the active terminal's input line.
- **Workflow:** "I need to `cat` this file" → click → path appears → press Enter.
- **Worth it?** Yes. This is the single feature that turns the tree from decoration into tool. ~20 lines of code.

### B. Copy path to clipboard
- **What:** Right-click or button copies the absolute path.
- **Workflow:** Grab a path to paste into a command you're already typing elsewhere.
- **Worth it?** Yes, but only as a companion to A. Standalone it's weak — most terminals already support drag-from-file-manager.

### C. Drag file into terminal → auto-type path
- **What:** HTML5 drag-and-drop from tree node onto terminal, inserts path at cursor.
- **Workflow:** Visual alternative to click-to-insert. Feels natural to anyone who drags files into iTerm2.
- **Worth it?** Nice-to-have. Same outcome as A, just a different input method. Skip unless A proves popular.

### D. Quick file actions (rename, delete, new file)
- **What:** Right-click context menu with file operations.
- **Workflow:** Manage files without leaving the app.
- **Worth it?** **No.** This is IDE territory. nyx-terminal is a terminal — the terminal *is* the file manager. Adding this invites scope creep and a second source of truth for filesystem state.

### E. File search/filter
- **What:** Filter box that narrows the tree by name.
- **Workflow:** Find a file in a large project without `find`.
- **Worth it?** Maybe later. Useful but not essential. The terminal already has `fzf`/`find` for this.

---

## 3. The Honest Take

**A terminal app is not an IDE.** The line is clear: an IDE edits files; a terminal runs commands. The file tree's job is to *feed the terminal*, not replace it.

If the tree only copies paths — that's borderline. It justifies existence only if path-entry is friction the developer actually feels. And they do: typing long paths by hand is annoying, and alt-tabbing to a file manager breaks flow.

**The minimum viable enhancement** that makes the tree worth keeping is **Option A: click-to-insert path**. Nothing else is required to justify the panel. Everything else is optional polish.

**Is there a killer feature?** Yes — and it's A, not something fancy. The killer move is making the tree *talk to the terminal*. The moment a click drops a path into the active pane, the tree stops being a viewer and becomes a controller. That's the whole pitch.

---

## 4. Recommendation

**Keep the tree. Add Option A only. Ship it. Revisit later.**

Concretely:
1. **Implement click-to-insert path** into the active terminal's input buffer.
2. **Add copy-path** as a right-click bonus (Option B) — it's nearly free once the path is accessible.
3. **Stop there.** No context menus for rename/delete. No search. No drag-and-drop. No metadata.

This keeps nyx-terminal honest: a terminal app with a file picker, not a half-built IDE. The tree earns its 280px. If nobody uses it after A ships, *then* remove it — but give it one real feature first.

**"Minimal" means:** the tree inserts paths. That's it. Everything else is later, or never.

---

*If I can't explain it, we don't understand it well enough yet.*
