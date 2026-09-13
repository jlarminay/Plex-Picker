import { XMLParser } from 'fast-xml-parser'
import { getSession } from './session.js'

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

export type Movie = {
  title: string
  year: number | null
  releaseDate: string | null
  genres: string[]
  directors: string[]
  countries: string[]
  rating: number | null
  duration: number | null
  summary: string
  studio: string
  thumb: string | null
  key: string
  addedAt: number | null
  watched: boolean
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
    key: item.key ?? '',
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
