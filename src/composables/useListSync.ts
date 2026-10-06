import { ref } from 'vue'
import type { LetterboxdList } from '../config/letterboxdLists'
import { fetchLetterboxdList, type LetterboxdFilm } from '../lib/letterboxd'
import { addToCollection, createCollection, getCollectionItemKeys, removeFromCollection } from '../lib/plex'
import { useMovieLibrary, type Movie } from './useMovieLibrary'

// Letterboxd is the source of truth: the Plex collection is made to hold exactly
// the list's films that are on the server. Anything that can't be confidently
// matched is reported rather than acted on, so a bad match never removes a film.

export const NEW_COLLECTION = '__new__'

export type SyncResult = {
  listName: string
  collectionTitle: string
  createdCollection: boolean
  note: string | null
  durationMs: number
  listCount: number
  added: Movie[]
  removed: Movie[]
  missing: LetterboxdFilm[]
  matchedByTitle: Array<{ film: LetterboxdFilm; movie: Movie }>
  unverified: Movie[]
}

const { movies, collections, fetchAndCacheMovies, applyCollectionChange, loadCollections } = useMovieLibrary()

const running = ref(false)
const progress = ref('')
const syncError = ref('')
const result = ref<SyncResult | null>(null)

const errorMessage = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback)

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')

// Letterboxd and Plex sometimes disagree on a release year by one (festival vs.
// theatrical), so the title fallback accepts a neighbouring year too.
function titleKeys(title: string, year: number | null): string[] {
  const name = normalizeTitle(title)
  if (year === null) return [`${name}|`]
  return [year, year - 1, year + 1].map((y) => `${name}|${y}`)
}

type Match = { film: LetterboxdFilm; movie: Movie; byTitle: boolean }

function matchFilms(films: LetterboxdFilm[], candidates: Movie[]): { matched: Match[]; missing: LetterboxdFilm[] } {
  const byTmdb = new Map<string, Movie>()
  const byTitle = new Map<string, Movie>()
  for (const movie of candidates) {
    if (!movie.ratingKey) continue
    if (movie.tmdbId && !byTmdb.has(movie.tmdbId)) byTmdb.set(movie.tmdbId, movie)
    const exact = titleKeys(movie.title, movie.year)[0]
    if (!byTitle.has(exact)) byTitle.set(exact, movie)
  }

  const matched: Match[] = []
  const missing: LetterboxdFilm[] = []
  for (const film of films) {
    const idMatch = film.tmdbId ? byTmdb.get(film.tmdbId) : undefined
    if (idMatch) {
      matched.push({ film, movie: idMatch, byTitle: false })
      continue
    }
    // Only fall back to the title when an id comparison wasn't possible —
    // two different TMDB ids are two different films, whatever their titles.
    const titleMatch = titleKeys(film.title, film.year)
      .map((key) => byTitle.get(key))
      .find((movie) => movie && !(film.tmdbId && movie.tmdbId))
    if (titleMatch) matched.push({ film, movie: titleMatch, byTitle: true })
    else missing.push(film)
  }
  return { matched, missing }
}

// A new collection goes in whichever movie library holds the most of the list.
function busiestSection(matched: Match[]): string | null {
  const counts = new Map<string, number>()
  for (const { movie } of matched) if (movie.sectionKey) counts.set(movie.sectionKey, (counts.get(movie.sectionKey) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

async function runSync(list: LetterboxdList, collectionKey: string) {
  running.value = true
  syncError.value = ''
  result.value = null
  const started = performance.now()
  try {
    const existing = collectionKey === NEW_COLLECTION ? null : collections.value.find((collection) => collection.ratingKey === collectionKey)
    if (collectionKey !== NEW_COLLECTION && !existing) throw new Error('That collection no longer exists. Reload the page and try again.')

    // Re-index first so movies added to Plex since the last index aren't reported missing.
    progress.value = 'Refreshing your Plex library…'
    await fetchAndCacheMovies()
    const films = await fetchLetterboxdList(list.url, (message) => (progress.value = message))

    const sectionKey = existing?.sectionKey ?? busiestSection(matchFilms(films, movies.value).matched)
    const { matched, missing } = matchFilms(films, sectionKey ? movies.value.filter((movie) => movie.sectionKey === sectionKey) : [])
    const wanted = new Set(matched.map(({ movie }) => movie.ratingKey as string))

    progress.value = 'Updating the Plex collection…'
    const currentKeys = existing ? await getCollectionItemKeys(existing.ratingKey) : []
    const current = new Set(currentKeys)
    const movieByKey = new Map(movies.value.map((movie) => [movie.ratingKey, movie]))
    const unmatchedTitles = new Set(missing.flatMap((film) => titleKeys(film.title, film.year)))

    const toAdd = [...wanted].filter((key) => !current.has(key))
    const toRemove: string[] = []
    const unverified: Movie[] = []
    for (const key of currentKeys) {
      if (wanted.has(key)) continue
      const movie = movieByKey.get(key)
      if (!movie) continue // not in the indexed library — leave it alone
      // Without a TMDB id, or when it might be a list film that failed to match, keep it and say so.
      if (!movie.tmdbId || unmatchedTitles.has(titleKeys(movie.title, movie.year)[0])) unverified.push(movie)
      else toRemove.push(key)
    }

    const collectionTitle = existing?.title ?? list.name
    let createdCollection = false
    let note: string | null = null
    if (existing) {
      await addToCollection(existing.ratingKey, toAdd)
      await removeFromCollection(existing.ratingKey, toRemove)
    } else if (sectionKey && toAdd.length) {
      await createCollection(list.name, sectionKey, toAdd)
      createdCollection = true
    } else {
      note = `None of this list's films are on your server, so the "${list.name}" collection wasn't created.`
    }

    const applied = existing || createdCollection
    if (applied) applyCollectionChange(collectionTitle, toAdd, toRemove)
    if (createdCollection) await loadCollections()

    const asMovies = (keys: string[]) => keys.map((key) => movieByKey.get(key)).filter((movie): movie is Movie => Boolean(movie))
    result.value = {
      listName: list.name,
      collectionTitle,
      createdCollection,
      note,
      durationMs: performance.now() - started,
      listCount: films.length,
      added: applied ? asMovies(toAdd) : [],
      removed: asMovies(toRemove),
      missing,
      matchedByTitle: matched.filter((match) => match.byTitle).map(({ film, movie }) => ({ film, movie })),
      unverified,
    }
  } catch (reason) {
    syncError.value = errorMessage(reason, 'The sync failed.')
  } finally {
    running.value = false
    progress.value = ''
  }
}

export function useListSync() {
  return { running, progress, syncError, result, runSync }
}
