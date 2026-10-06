import { Capacitor, CapacitorHttp } from '@capacitor/core'

// Letterboxd has no public API, so lists are read from their public HTML pages.
// This goes through CapacitorHttp (native networking) rather than fetch():
// letterboxd.com sends no CORS headers, so a WebView fetch() would be blocked.
// It's used directly instead of enabling Capacitor's global fetch patching,
// which would also reroute every Plex request. In a desktop browser (npm run dev)
// requests go through Vite's /letterboxd proxy instead — see vite.config.ts.

export type LetterboxdFilm = { slug: string; title: string; year: number | null; url: string; tmdbId: string | null }

const BASE = 'https://letterboxd.com'
const PAGE_SIZE = 100
const LOOKUP_CONCURRENCY = 4
const TMDB_CACHE_KEY = 'plex-picker:letterboxd-tmdb'

async function getHtml(url: string): Promise<Document> {
  if (!Capacitor.isNativePlatform()) {
    if (!import.meta.env.DEV) throw new Error('Letterboxd sync only works in the app (or npm run dev).')
    const response = await fetch(url.replace(BASE, '/letterboxd'), { headers: { Accept: 'text/html' } })
    if (!response.ok) throw new Error(`Letterboxd returned ${response.status} for ${url}`)
    return new DOMParser().parseFromString(await response.text(), 'text/html')
  }
  const response = await CapacitorHttp.get({
    url,
    // Letterboxd sits behind Cloudflare, which is wary of non-browser user agents.
    headers: { Accept: 'text/html', 'User-Agent': navigator.userAgent },
    responseType: 'text',
  })
  if (response.status !== 200) throw new Error(`Letterboxd returned ${response.status} for ${url}`)
  return new DOMParser().parseFromString(String(response.data), 'text/html')
}

// "Title (Year)" — the year is optional for unreleased films.
function parseDisplayName(name: string): { title: string; year: number | null } {
  const match = name.match(/^(.*) \((\d{4})\)$/)
  return match ? { title: match[1], year: Number(match[2]) } : { title: name, year: null }
}

// List pages hold 100 films each; a page past the end comes back with none.
async function readListPages(listUrl: string, onProgress: (message: string) => void): Promise<Omit<LetterboxdFilm, 'tmdbId'>[]> {
  const base = listUrl.replace(/\/+$/, '')
  const films: Omit<LetterboxdFilm, 'tmdbId'>[] = []
  for (let page = 1; ; page++) {
    onProgress(`Reading Letterboxd list (page ${page})…`)
    const doc = await getHtml(page === 1 ? `${base}/` : `${base}/page/${page}/`)
    const entries = Array.from(doc.querySelectorAll<HTMLElement>('[data-item-slug]'))
    for (const entry of entries) {
      const slug = entry.dataset.itemSlug ?? ''
      if (!slug || films.some((film) => film.slug === slug)) continue
      const { title, year } = parseDisplayName(entry.dataset.itemFullDisplayName ?? entry.dataset.itemName ?? slug)
      films.push({ slug, title, year, url: `${BASE}${entry.dataset.itemLink ?? `/film/${slug}/`}` })
    }
    if (entries.length < PAGE_SIZE) return films
  }
}

// slug → TMDB id ('' when a film page has none), so each film is looked up once ever.
function loadTmdbCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveTmdbCache(cache: Record<string, string>) {
  try {
    localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // storage unavailable — lookups just repeat next time
  }
}

async function lookupTmdbId(film: Omit<LetterboxdFilm, 'tmdbId'>): Promise<string> {
  const doc = await getHtml(film.url)
  // TV entries carry a TV TMDB id, which would never match a Plex movie.
  if (doc.body.dataset.tmdbType && doc.body.dataset.tmdbType !== 'movie') return ''
  return doc.body.dataset.tmdbId ?? ''
}

export async function fetchLetterboxdList(listUrl: string, onProgress: (message: string) => void): Promise<LetterboxdFilm[]> {
  const films = await readListPages(listUrl, onProgress)
  const cache = loadTmdbCache()
  const pending = films.filter((film) => !(film.slug in cache))

  let done = 0
  let next = 0
  async function worker() {
    while (next < pending.length) {
      const film = pending[next++]
      cache[film.slug] = await lookupTmdbId(film)
      done++
      onProgress(`Looking up films on Letterboxd (${done}/${pending.length})…`)
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(LOOKUP_CONCURRENCY, pending.length) }, worker))
  } finally {
    // Keep whatever was looked up even if a request failed partway through.
    saveTmdbCache(cache)
  }

  return films.map((film) => ({ ...film, tmdbId: cache[film.slug] || null }))
}
