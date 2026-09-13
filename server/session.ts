import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SESSION_DIR = path.join(process.cwd(), '.data')
const SESSION_PATH = path.join(SESSION_DIR, 'session.json')

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

function defaultSession(): Session {
  return { clientIdentifier: randomUUID(), authToken: null, account: null, server: null }
}

function persist(value: Session) {
  mkdirSync(SESSION_DIR, { recursive: true })
  writeFileSync(SESSION_PATH, JSON.stringify(value, null, 2))
}

function load(): Session {
  if (existsSync(SESSION_PATH)) {
    try {
      return { ...defaultSession(), ...JSON.parse(readFileSync(SESSION_PATH, 'utf-8')) }
    } catch {
      // corrupt session file — fall through and start fresh
    }
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
