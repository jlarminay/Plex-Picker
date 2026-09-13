import { getSession } from './session.js'

const PLEX_TV = 'https://plex.tv'
const PRODUCT = 'Plex Picker'
const CONNECTION_TIMEOUT_MS = 4000

function headers(extra: Record<string, string> = {}) {
  return {
    Accept: 'application/json',
    'X-Plex-Client-Identifier': getSession().clientIdentifier,
    'X-Plex-Product': PRODUCT,
    'X-Plex-Device-Name': PRODUCT,
    ...extra,
  }
}

export type PlexPin = { id: number; code: string; authToken: string | null }

export async function createPin(): Promise<PlexPin> {
  const response = await fetch(`${PLEX_TV}/api/v2/pins?strong=true`, { method: 'POST', headers: headers() })
  if (!response.ok) throw new Error(`Plex.tv rejected the sign-in request (${response.status}).`)
  return response.json()
}

export function authUrlForPin(pin: PlexPin): string {
  const params = new URLSearchParams({
    clientID: getSession().clientIdentifier,
    code: pin.code,
    'context[device][product]': PRODUCT,
  })
  return `https://app.plex.tv/auth#?${params.toString()}`
}

export async function checkPin(id: number): Promise<PlexPin> {
  const response = await fetch(`${PLEX_TV}/api/v2/pins/${id}`, { headers: headers() })
  if (!response.ok) throw new Error(`That sign-in request expired. Try again.`)
  return response.json()
}

export async function getAccount(authToken: string): Promise<{ username: string; email: string; thumb: string | null }> {
  const response = await fetch(`${PLEX_TV}/api/v2/user`, { headers: headers({ 'X-Plex-Token': authToken }) })
  if (!response.ok) throw new Error('Unable to load your Plex account details.')
  const data = await response.json()
  return { username: data.username ?? data.title ?? 'Plex user', email: data.email ?? '', thumb: data.thumb ?? null }
}

export type PlexConnection = { uri: string; local: boolean; relay: boolean }
export type PlexResource = { name: string; clientIdentifier: string; accessToken: string; connections: PlexConnection[] }

export async function getServers(authToken: string): Promise<PlexResource[]> {
  const response = await fetch(`${PLEX_TV}/api/v2/resources?includeHttps=1&includeRelay=1`, {
    headers: headers({ 'X-Plex-Token': authToken }),
  })
  if (!response.ok) throw new Error('Unable to load your Plex servers.')
  const devices = (await response.json()) as Array<{
    name: string
    provides?: string
    clientIdentifier: string
    accessToken: string
    connections?: Array<{ uri: string; local?: boolean; relay?: boolean }>
  }>
  return devices
    .filter((device) => (device.provides ?? '').split(',').includes('server'))
    .map((device) => ({
      name: device.name,
      clientIdentifier: device.clientIdentifier,
      accessToken: device.accessToken,
      connections: (device.connections ?? []).map((c) => ({ uri: c.uri, local: Boolean(c.local), relay: Boolean(c.relay) })),
    }))
}

// Direct remote connections are tried first (fastest), then Plex's relay tunnel,
// then local addresses last since this backend usually isn't on the same LAN as the server.
function score(connection: PlexConnection) {
  if (!connection.local && !connection.relay) return 0
  if (connection.relay) return 1
  return 2
}

export async function resolveConnection(resource: PlexResource): Promise<string> {
  const ordered = [...resource.connections].sort((a, b) => score(a) - score(b))
  for (const connection of ordered) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS)
    try {
      const response = await fetch(`${connection.uri}/identity`, {
        headers: { 'X-Plex-Token': resource.accessToken },
        signal: controller.signal,
      })
      if (response.ok) return connection.uri
    } catch {
      // unreachable on this route — try the next one
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(`Could not reach "${resource.name}" directly, via relay, or locally.`)
}
