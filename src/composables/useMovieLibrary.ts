import { computed, ref, watch } from 'vue'
import { getSession } from '../lib/localSession'
import { loadCachedMovies, saveCachedMovies } from '../lib/movieCache'
import { getMovieCollections, indexMovies, type PlexCollection } from '../lib/plex'
import { useAsyncStatus } from './useAsyncStatus'

export type Movie = {
  ratingKey: string | null
  sectionKey: string | null
  tmdbId: string | null
  title: string
  year: number | null
  releaseDate: string | null
  genres: string[]
  directors: string[]
  countries: string[]
  collections: string[]
  rating: number | null
  duration: number | null
  // Server-relative poster path — turn into a URL with posterUrl().
  thumb: string | null
  addedAt: number | null
  watched: boolean
}

export type SortKey = 'added' | 'release' | 'title' | 'duration'
export type SortDir = 'asc' | 'desc'

export function formatDuration(minutes: number | null): string {
  if (!minutes) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const { loading, error } = useAsyncStatus()

const movies = ref<Movie[]>([])
const query = ref('')
const filter = ref('all')
const sortBy = ref<SortKey>('added')

const defaultSortDir: Record<SortKey, SortDir> = { added: 'desc', release: 'desc', title: 'asc', duration: 'desc' }
const sortDir = ref<SortDir>(defaultSortDir.added)
watch(sortBy, (key) => {
  sortDir.value = defaultSortDir[key]
})

const genres = computed(() => [...new Set(movies.value.flatMap((movie) => movie.genres))].sort())
const countries = computed(() => [...new Set(movies.value.flatMap((movie) => movie.countries))].sort())
// Plex's own collection list, shared by the picker's filter and the list sync.
// Loaded from the home page so both always see the same, current set.
const collections = ref<PlexCollection[]>([])
const collectionsLoading = ref(false)
const collectionsError = ref('')

// A "_" prefix is a common Plex convention for pinning a collection to the top
// of its own sort order — honor that here instead of sorting it in with the rest.
function compareCollections(a: PlexCollection, b: PlexCollection) {
  const aPinned = a.title.startsWith('_')
  const bPinned = b.title.startsWith('_')
  if (aPinned !== bPinned) return aPinned ? -1 : 1
  return a.title.localeCompare(b.title)
}

async function loadCollections() {
  collectionsLoading.value = true
  collectionsError.value = ''
  try {
    collections.value = (await getMovieCollections()).sort(compareCollections)
  } catch (reason) {
    collectionsError.value = reason instanceof Error ? reason.message : 'Unable to load your Plex collections.'
  } finally {
    collectionsLoading.value = false
  }
}

const filtered = computed(() =>
  movies.value.filter(
    (movie) =>
      `${movie.title} ${movie.directors.join(' ')} ${movie.genres.join(' ')}`.toLowerCase().includes(query.value.toLowerCase()) &&
      (filter.value === 'all' || movie.genres.includes(filter.value)),
  ),
)

const sortComparators: Record<SortKey, (a: Movie, b: Movie) => number> = {
  added: (a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0),
  release: (a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''),
  title: (a, b) => a.title.localeCompare(b.title),
  duration: (a, b) => (a.duration ?? 0) - (b.duration ?? 0),
}

const sorted = computed(() => {
  const direction = sortDir.value === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => direction * sortComparators[sortBy.value](a, b))
})

const PAGE_SIZE = 60
const visibleCount = ref(PAGE_SIZE)
const visibleMovies = computed(() => sorted.value.slice(0, visibleCount.value))

watch([query, filter, sortBy, sortDir, movies], () => {
  visibleCount.value = PAGE_SIZE
})

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, sorted.value.length)
}

const stats = computed(() => ({
  years: new Set(movies.value.map((movie) => movie.year).filter(Boolean)).size,
  genres: new Set(movies.value.flatMap((movie) => movie.genres)).size,
  directors: new Set(movies.value.flatMap((movie) => movie.directors)).size,
  countries: new Set(movies.value.flatMap((movie) => movie.countries)).size,
}))

function topCounts(values: string[], limit: number): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

const topGenres = computed(() => topCounts(movies.value.flatMap((movie) => movie.genres), 8))
const topDirectors = computed(() => topCounts(movies.value.flatMap((movie) => movie.directors), 8))
const topCountries = computed(() => topCounts(movies.value.flatMap((movie) => movie.countries), 8))
const byDecade = computed(() => {
  const decades = new Map<number, number>()
  for (const movie of movies.value) {
    if (!movie.year) continue
    const decade = Math.floor(movie.year / 10) * 10
    decades.set(decade, (decades.get(decade) ?? 0) + 1)
  }
  return [...decades.entries()].sort((a, b) => a[0] - b[0])
})

const DURATION_BUCKETS: Array<{ label: string; matches: (minutes: number) => boolean }> = [
  { label: 'Under 30m', matches: (m) => m < 30 },
]
for (let start = 30; start < 120; start += 15) {
  const end = start + 15
  DURATION_BUCKETS.push({ label: `${start}–${end}m`, matches: (m) => m >= start && m < end })
}
DURATION_BUCKETS.push({ label: '120m+', matches: (m) => m >= 120 })

const byDuration = computed<Array<[string, number]>>(() => {
  const counts = DURATION_BUCKETS.map(() => 0)
  for (const movie of movies.value) {
    if (movie.duration === null) continue
    const index = DURATION_BUCKETS.findIndex((bucket) => bucket.matches(movie.duration as number))
    if (index !== -1) counts[index]++
  }
  return DURATION_BUCKETS.map((bucket, index) => [bucket.label, counts[index]])
})

const RATING_BUCKETS: Array<{ label: string; matches: (rating: number) => boolean }> = [
  { label: 'Under 5', matches: (r) => r < 5 },
  { label: '5–6', matches: (r) => r >= 5 && r < 6 },
  { label: '6–7', matches: (r) => r >= 6 && r < 7 },
  { label: '7–8', matches: (r) => r >= 7 && r < 8 },
  { label: '8–9', matches: (r) => r >= 8 && r < 9 },
  { label: '9+', matches: (r) => r >= 9 },
]

const byRating = computed<Array<[string, number]>>(() => {
  const counts = RATING_BUCKETS.map(() => 0)
  for (const movie of movies.value) {
    if (movie.rating === null) continue
    const index = RATING_BUCKETS.findIndex((bucket) => bucket.matches(movie.rating as number))
    if (index !== -1) counts[index]++
  }
  return RATING_BUCKETS.map((bucket, index) => [bucket.label, counts[index]])
})

const maxCount = (rows: Array<[string | number, number]>) => Math.max(1, ...rows.map(([, count]) => count))
const maxDecadeCount = computed(() => maxCount(byDecade.value))
const maxGenreCount = computed(() => maxCount(topGenres.value))
const maxDirectorCount = computed(() => maxCount(topDirectors.value))
const maxCountryCount = computed(() => maxCount(topCountries.value))
const maxDurationCount = computed(() => maxCount(byDuration.value))
const maxRatingCount = computed(() => maxCount(byRating.value))

function abbreviateDirectorName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`
}

let lastIndexedAt = 0

async function fetchAndCacheMovies() {
  const startedFor = getSession().server?.clientIdentifier
  const fresh = await indexMovies()
  // Signed out or switched servers while indexing — this result is for the wrong library.
  const server = getSession().server
  if (!server || server.clientIdentifier !== startedFor) return
  lastIndexedAt = Date.now()
  // An unchanged library keeps the current list, so nothing on screen re-renders.
  if (JSON.stringify(fresh) !== JSON.stringify(movies.value)) movies.value = fresh
  await saveCachedMovies(server.clientIdentifier, fresh)
}

let backgroundRefresh: Promise<void> | undefined

// Quietly re-indexes behind whatever is already showing, to pick up new movies
// and watched status. A failure (offline, server asleep) just leaves the cache up.
function refreshInBackground() {
  backgroundRefresh ??= fetchAndCacheMovies()
    .catch(() => {})
    .finally(() => {
      backgroundRefresh = undefined
    })
  return backgroundRefresh
}

// Cache-first: an already-indexed library shows instantly, then is brought up
// to date in the background.
async function loadMovies() {
  const server = getSession().server
  if (server) {
    const cached = await loadCachedMovies(server.clientIdentifier)
    if (cached) {
      movies.value = cached
      void refreshInBackground()
      return
    }
  }
  await fetchAndCacheMovies()
}

// The app usually stays open between movie nights rather than relaunching, so
// coming back to it also re-indexes once the library is a few minutes old.
const STALE_AFTER_MS = 5 * 60 * 1000
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !getSession().server || !movies.value.length) return
  if (Date.now() - lastIndexedAt > STALE_AFTER_MS) void refreshInBackground()
})

async function refreshLibrary() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([fetchAndCacheMovies(), loadCollections()])
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to refresh the library.'
  } finally {
    loading.value = false
  }
}

// Mirrors a collection edit into the indexed library (and its cache), so the
// picker's collection filter is current without re-indexing everything.
function applyCollectionChange(title: string, addedKeys: string[], removedKeys: string[]) {
  const added = new Set(addedKeys)
  const removed = new Set(removedKeys)
  movies.value = movies.value.map((movie) => {
    if (!movie.ratingKey) return movie
    if (added.has(movie.ratingKey) && !movie.collections.includes(title)) return { ...movie, collections: [...movie.collections, title] }
    if (removed.has(movie.ratingKey)) return { ...movie, collections: movie.collections.filter((name) => name !== title) }
    return movie
  })
  const server = getSession().server
  if (server) saveCachedMovies(server.clientIdentifier, movies.value)
}

function resetMovies() {
  movies.value = []
}

export function useMovieLibrary() {
  return {
    movies,
    query,
    filter,
    sortBy,
    sortDir,
    genres,
    countries,
    collections,
    collectionsLoading,
    collectionsError,
    loadCollections,
    filtered,
    sorted,
    visibleMovies,
    PAGE_SIZE,
    loadMore,
    stats,
    topGenres,
    topDirectors,
    topCountries,
    byDecade,
    byDuration,
    byRating,
    maxDecadeCount,
    maxGenreCount,
    maxDirectorCount,
    maxCountryCount,
    maxDurationCount,
    maxRatingCount,
    abbreviateDirectorName,
    loadMovies,
    fetchAndCacheMovies,
    refreshLibrary,
    applyCollectionChange,
    resetMovies,
  }
}
