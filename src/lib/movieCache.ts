import type { Movie } from '../composables/useMovieLibrary'

const CACHE_KEY_PREFIX = 'plex-picker:movies:'

export function loadCachedMovies(serverClientIdentifier: string): Movie[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + serverClientIdentifier)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCachedMovies(serverClientIdentifier: string, movies: Movie[]) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + serverClientIdentifier, JSON.stringify(movies))
  } catch {
    // storage full or unavailable — skip caching silently, the app still works without it
  }
}
