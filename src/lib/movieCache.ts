import type { Movie } from '../composables/useMovieLibrary'

// The indexed library lives in IndexedDB rather than localStorage, whose ~5 MB
// cap a large library can exceed. Every failure here is swallowed: without a
// cache the app still works, it just re-indexes on launch.

const DB_NAME = 'plex-picker'
const STORE = 'movies'
// Bump when the Movie shape changes, so older caches are re-indexed instead of read.
const CACHE_VERSION = 1
const LEGACY_KEY_PREFIX = 'plex-picker:movies:'

type CacheEntry = { version: number; movies: Movie[] }

let dbPromise: Promise<IDBDatabase> | undefined

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = action(transaction.objectStore(STORE))
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }),
  )
}

// The library used to be cached in localStorage — free that space.
function clearLegacyCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(LEGACY_KEY_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // storage unavailable — nothing to clear
  }
}
clearLegacyCache()

export async function loadCachedMovies(serverClientIdentifier: string): Promise<Movie[] | null> {
  try {
    const entry = await run<CacheEntry | undefined>('readonly', (store) => store.get(serverClientIdentifier))
    return entry?.version === CACHE_VERSION ? entry.movies : null
  } catch {
    return null
  }
}

export async function saveCachedMovies(serverClientIdentifier: string, movies: Movie[]) {
  try {
    // IndexedDB can't clone Vue's reactive proxies, so store a plain copy.
    const entry: CacheEntry = { version: CACHE_VERSION, movies: JSON.parse(JSON.stringify(movies)) }
    await run('readwrite', (store) => store.put(entry, serverClientIdentifier))
  } catch {
    // storage full or unavailable — skip caching, the app still works without it
  }
}
