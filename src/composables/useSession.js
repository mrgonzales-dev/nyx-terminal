export function useSession() {
  async function loadSession() {
    try {
      const res = await fetch('/api/session')
      return await res.json()
    } catch (e) {
      return { terminals: [] }
    }
  }

  async function saveSession(data) {
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    } catch (e) {
      console.error('Failed to save session:', e)
    }
  }

  return {
    loadSession,
    saveSession
  }
}
