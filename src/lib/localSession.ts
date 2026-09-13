// Persists sign-in state in the browser instead of a backend session file.
// Kept as a small get/set module so the storage backend (e.g. swapping to
// @capacitor/preferences once this runs inside a native shell) is a one-file change.

export type SelectedServer = {
  name: string
  clientIdentifier: string
  uri: string
  accessToken: string
}

export type Account = { username: string; email: string; thumb: string | null }

export type Session = {
  clientIdentifier: string
  authToken: string | null
  account: Account | null
  server: SelectedServer | null
}

const STORAGE_KEY = 'plex-picker:session'

function defaultSession(): Session {
  return { clientIdentifier: crypto.randomUUID(), authToken: null, account: null, server: null }
}

function persist(value: Session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // storage unavailable (private browsing, quota) — session just won't survive a reload
  }
}

function load(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultSession(), ...JSON.parse(raw) }
  } catch {
    // corrupt/unavailable storage — fall through and start fresh
  }
  const fresh = defaultSession()
  persist(fresh)
  return fresh
}

let session = load()

export function getSession(): Session {
  return session
}

export function updateSession(patch: Partial<Session>): Session {
  session = { ...session, ...patch }
  persist(session)
  return session
}
