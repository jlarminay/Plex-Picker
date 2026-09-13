import { computed, ref, watch } from 'vue'
import { getSession } from '../lib/localSession'
import { loadCachedMovies, saveCachedMovies } from '../lib/movieCache'
import { indexMovies } from '../lib/plex'
import { useAsyncStatus } from './useAsyncStatus'

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
  { label: '30–60m', matches: (m) => m >= 30 && m < 60 },
  { label: '60–90m', matches: (m) => m >= 60 && m < 90 },
  { label: '90–120m', matches: (m) => m >= 90 && m < 120 },
  { label: '120m+', matches: (m) => m >= 120 },
]

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

async function fetchAndCacheMovies() {
  const fresh = await indexMovies()
  movies.value = fresh
  const server = getSession().server
  if (server) saveCachedMovies(server.clientIdentifier, fresh)
}

// Cache-first: an already-indexed library shows instantly with no re-fetch.
// Use refreshLibrary() to force a live re-index (e.g. after adding new movies in Plex).
async function loadMovies() {
  const server = getSession().server
  if (server) {
    const cached = loadCachedMovies(server.clientIdentifier)
    if (cached) {
      movies.value = cached
      return
    }
  }
  await fetchAndCacheMovies()
}

async function refreshLibrary() {
  loading.value = true
  error.value = ''
  try {
    await fetchAndCacheMovies()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to refresh the library.'
  } finally {
    loading.value = false
  }
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
    refreshLibrary,
    resetMovies,
  }
}
