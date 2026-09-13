import { XMLParser } from 'fast-xml-parser'
import type { Movie } from '../composables/useMovieLibrary'
import { getSession } from './localSession'

const PLEX_TV = 'https://plex.tv'
const PRODUCT = 'Plex Picker'
const CONNECTION_TIMEOUT_MS = 4000

function plexTvHeaders(extra: Record<string, string> = {}) {
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
  const response = await fetch(`${PLEX_TV}/api/v2/pins?strong=true`, { method: 'POST', headers: plexTvHeaders() })
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
  const response = await fetch(`${PLEX_TV}/api/v2/pins/${id}`, { headers: plexTvHeaders() })
  if (!response.ok) throw new Error('That sign-in request expired. Try again.')
  return response.json()
}

export async function getAccount(authToken: string): Promise<{ username: string; email: string; thumb: string | null }> {
  const response = await fetch(`${PLEX_TV}/api/v2/user`, { headers: plexTvHeaders({ 'X-Plex-Token': authToken }) })
  if (!response.ok) throw new Error('Unable to load your Plex account details.')
  const data = await response.json()
  return { username: data.username ?? data.title ?? 'Plex user', email: data.email ?? '', thumb: data.thumb ?? null }
}

export type PlexConnection = { uri: string; local: boolean; relay: boolean }
export type PlexResource = { name: string; clientIdentifier: string; accessToken: string; connections: PlexConnection[] }

export async function getServers(authToken: string): Promise<PlexResource[]> {
  const response = await fetch(`${PLEX_TV}/api/v2/resources?includeHttps=1&includeRelay=1`, {
    headers: plexTvHeaders({ 'X-Plex-Token': authToken }),
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

// Direct remote connections are tried first (fastest), then Plex's relay tunnel, then local last.
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

// ---- Plex Media Server library queries ----

type PlexItem = {
  title?: string
  year?: number
  Genre?: Array<{ tag?: string }> | { tag?: string }
  Director?: Array<{ tag?: string }> | { tag?: string }
  Country?: Array<{ tag?: string }> | { tag?: string }
  rating?: number
  duration?: number
  summary?: string
  studio?: string
  thumb?: string
  key?: string
  addedAt?: number
  originallyAvailableAt?: string
  viewCount?: number
}

const asArray = <T,>(value: T | T[] | undefined): T[] => (value ? (Array.isArray(value) ? value : [value]) : [])

function plexUrl(path: string): string {
  const server = getSession().server
  if (!server) throw new Error('No Plex server connected yet.')
  const base = server.uri.replace(/\/$/, '')
  const separator = path.includes('?') ? '&' : '?'
  return `${base}${path}${separator}X-Plex-Token=${encodeURIComponent(server.accessToken)}`
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true, htmlEntities: true })

async function plexFetch(path: string) {
  const response = await fetch(plexUrl(path), { headers: { Accept: 'application/xml' } })
  if (!response.ok) throw new Error(`Plex returned ${response.status} ${response.statusText}`)
  return parser.parse(await response.text())
}

function normalize(item: PlexItem): Movie {
  return {
    title: item.title ?? 'Untitled',
    year: item.year ?? null,
    releaseDate: item.originallyAvailableAt ?? null,
    genres: asArray(item.Genre).map((entry) => entry.tag).filter((tag): tag is string => Boolean(tag)),
    directors: asArray(item.Director).map((entry) => entry.tag).filter((tag): tag is string => Boolean(tag)),
    countries: asArray(item.Country).map((entry) => entry.tag).filter((tag): tag is string => Boolean(tag)),
    rating: item.rating ?? null,
    duration: item.duration ? Math.round(item.duration / 60000) : null,
    summary: item.summary ?? '',
    studio: item.studio ?? '',
    thumb: item.thumb ? plexUrl(item.thumb) : null,
    addedAt: item.addedAt ?? null,
    watched: Boolean(item.viewCount),
  }
}

export async function indexMovies(): Promise<Movie[]> {
  const libraries = await plexFetch('/library/sections')
  const directories = asArray(libraries.MediaContainer?.Directory) as Array<{ type?: string; key?: string }>
  const movieLibraries = directories.filter((directory) => directory.type === 'movie')
  const items = (
    await Promise.all(
      movieLibraries.map(async (library) => {
        const result = await plexFetch(`/library/sections/${library.key}/all`)
        return asArray(result.MediaContainer?.Video) as PlexItem[]
      }),
    )
  ).flat()
  return items.map(normalize)
}

export async function verifyManualConnection(uri: string, accessToken: string): Promise<void> {
  const response = await fetch(`${uri.replace(/\/$/, '')}/identity`, { headers: { 'X-Plex-Token': accessToken } })
  if (!response.ok) throw new Error(`Unable to reach that server (${response.status}).`)
}
