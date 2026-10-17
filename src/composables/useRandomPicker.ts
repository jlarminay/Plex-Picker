import { ref } from 'vue'
import { useMovieLibrary, type Movie } from './useMovieLibrary'

export type DurationFilter = 'any' | 'under120' | 'under90'

const { movies } = useMovieLibrary()

const advancedOpen = ref(false)
const pickerGenres = ref<string[]>([])
const pickerDecades = ref<number[]>([])
// Specific calendar years (this year / last year), OR-ed with the decades.
const pickerYears = ref<number[]>([])
const pickerCountries = ref<string[]>([])
const pickerCollection = ref('')
const pickerDuration = ref<DurationFilter>('any')
const pickerHideWatched = ref(false)
const pickedMovies = ref<Movie[]>([])
const heldFlags = ref<boolean[]>([])
// A per-slot id for the v-for :key, deliberately independent of the movie's
// own identity — see pickIds below.
const pickIds = ref<number[]>([])
const noPickerMatches = ref(false)
const matchCount = ref(0)
let nextPickId = 0

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
}

function togglePickerGenre(genre: string) {
  pickerGenres.value = toggleInList(pickerGenres.value, genre)
}

function togglePickerDecade(decade: number) {
  pickerDecades.value = toggleInList(pickerDecades.value, decade)
}

function togglePickerYear(year: number) {
  pickerYears.value = toggleInList(pickerYears.value, year)
}

function togglePickerCountry(country: string) {
  pickerCountries.value = toggleInList(pickerCountries.value, country)
}

// Content identity (Plex can list the same film twice — duplicate files, or
// the same title across two library sections) — used to keep one film out of
// two slots at once. Deliberately NOT used as the v-for :key; see pickIds.
function movieKey(movie: Movie): string {
  return movie.title + movie.year
}

function dedupeByKey(list: Movie[]): Movie[] {
  const seen = new Set<string>()
  return list.filter((movie) => {
    const key = movieKey(movie)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function matchesFilters(movie: Movie): boolean {
  if (pickerGenres.value.length && !movie.genres.some((genre) => pickerGenres.value.includes(genre))) return false
  if (pickerDecades.value.length || pickerYears.value.length) {
    const decade = movie.year ? Math.floor(movie.year / 10) * 10 : null
    const inDecade = decade !== null && pickerDecades.value.includes(decade)
    const inYear = movie.year !== null && pickerYears.value.includes(movie.year)
    if (!inDecade && !inYear) return false
  }
  if (pickerCountries.value.length && !movie.countries.some((country) => pickerCountries.value.includes(country))) return false
  if (pickerCollection.value && !(movie.collections ?? []).includes(pickerCollection.value)) return false
  if (pickerDuration.value === 'under120' && !(movie.duration !== null && movie.duration < 120)) return false
  if (pickerDuration.value === 'under90' && !(movie.duration !== null && movie.duration < 90)) return false
  if (pickerHideWatched.value && movie.watched) return false
  return true
}

function findMoviesToWatch() {
  const pool = dedupeByKey(movies.value.filter(matchesFilters))
  matchCount.value = pool.length
  if (!pool.length) {
    noPickerMatches.value = true
    pickedMovies.value = []
    heldFlags.value = []
    return
  }
  noPickerMatches.value = false
  pickedMovies.value = shuffle(pool).slice(0, window.matchMedia('(orientation: portrait)').matches ? 6 : 5)
  heldFlags.value = pickedMovies.value.map(() => false)
  pickIds.value = pickedMovies.value.map(() => nextPickId++)
}

function toggleHold(index: number) {
  const next = [...heldFlags.value]
  next[index] = !next[index]
  heldFlags.value = next
}

// Re-picks only the slots that aren't held, leaving held movies untouched —
// their pickIds entry is carried over unchanged, so their SlotReel keeps its
// v-for :key and never remounts/re-spins. Rerolled slots always get a fresh
// id, even if the new pick happens to be a movie that was already showing:
// keying by the movie itself would let Vue reuse that old, already-settled
// SlotReel instance instead of mounting a new one — it would never fire
// "settled" again, and the whole row would wait forever for it.
function rerollPicker() {
  const heldMovies = pickedMovies.value.filter((_, index) => heldFlags.value[index])
  const rerollCount = pickedMovies.value.length - heldMovies.length
  if (!rerollCount) return

  const allMatches = dedupeByKey(movies.value.filter(matchesFilters))
  matchCount.value = allMatches.length

  const heldKeys = new Set(heldMovies.map(movieKey))
  const pool = allMatches.filter((movie) => !heldKeys.has(movieKey(movie)))
  if (!pool.length) {
    noPickerMatches.value = true
    return
  }
  noPickerMatches.value = false
  const fresh = shuffle(pool).slice(0, rerollCount)

  const newMovies: Movie[] = []
  const newHeld: boolean[] = []
  const newIds: number[] = []
  let freshIndex = 0
  for (let index = 0; index < pickedMovies.value.length; index++) {
    if (heldFlags.value[index]) {
      newMovies.push(pickedMovies.value[index])
      newHeld.push(true)
      newIds.push(pickIds.value[index])
    } else if (freshIndex < fresh.length) {
      newMovies.push(fresh[freshIndex++])
      newHeld.push(false)
      newIds.push(nextPickId++)
    }
  }
  pickedMovies.value = newMovies
  heldFlags.value = newHeld
  pickIds.value = newIds
}

// Reorders the current picks without changing any of them. Each slot's hold
// flag and pickId travel with its movie, so no SlotReel remounts or re-spins.
// Re-shuffles until the order actually changes, so the button never no-ops.
function shufflePicker() {
  const count = pickedMovies.value.length
  if (count < 2) return
  let order = shuffle([...Array(count).keys()])
  while (order.every((from, to) => from === to)) order = shuffle(order)
  pickedMovies.value = order.map((from) => pickedMovies.value[from])
  heldFlags.value = order.map((from) => heldFlags.value[from])
  pickIds.value = order.map((from) => pickIds.value[from])
}

function retryPicker() {
  pickedMovies.value = []
  heldFlags.value = []
  pickIds.value = []
  noPickerMatches.value = false
}

export function useRandomPicker() {
  return {
    advancedOpen,
    pickerGenres,
    pickerDecades,
    pickerYears,
    pickerCountries,
    pickerCollection,
    pickerDuration,
    pickerHideWatched,
    pickedMovies,
    heldFlags,
    pickIds,
    noPickerMatches,
    matchCount,
    togglePickerGenre,
    togglePickerDecade,
    togglePickerYear,
    togglePickerCountry,
    findMoviesToWatch,
    toggleHold,
    rerollPicker,
    shufflePicker,
    retryPicker,
  }
}
