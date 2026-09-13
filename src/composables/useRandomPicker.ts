import { ref } from 'vue'
import { useMovieLibrary, type Movie } from './useMovieLibrary'

export type DurationFilter = 'any' | 'under120' | 'under90'

const { movies } = useMovieLibrary()

const advancedOpen = ref(false)
const pickerGenres = ref<string[]>([])
const pickerDecades = ref<number[]>([])
const pickerCountries = ref<string[]>([])
const pickerDuration = ref<DurationFilter>('any')
const pickerHideWatched = ref(false)
const pickedMovies = ref<Movie[]>([])
const noPickerMatches = ref(false)

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
}

function togglePickerGenre(genre: string) {
  pickerGenres.value = toggleInList(pickerGenres.value, genre)
}

function togglePickerDecade(decade: number) {
  pickerDecades.value = toggleInList(pickerDecades.value, decade)
}

function togglePickerCountry(country: string) {
  pickerCountries.value = toggleInList(pickerCountries.value, country)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function findMoviesToWatch() {
  const pool = movies.value.filter((movie) => {
    if (pickerGenres.value.length && !movie.genres.some((genre) => pickerGenres.value.includes(genre))) return false
    if (pickerDecades.value.length) {
      const decade = movie.year ? Math.floor(movie.year / 10) * 10 : null
      if (decade === null || !pickerDecades.value.includes(decade)) return false
    }
    if (pickerCountries.value.length && !movie.countries.some((country) => pickerCountries.value.includes(country))) return false
    if (pickerDuration.value === 'under120' && !(movie.duration !== null && movie.duration < 120)) return false
    if (pickerDuration.value === 'under90' && !(movie.duration !== null && movie.duration < 90)) return false
    if (pickerHideWatched.value && movie.watched) return false
    return true
  })
  if (!pool.length) {
    noPickerMatches.value = true
    pickedMovies.value = []
    return
  }
  noPickerMatches.value = false
  pickedMovies.value = shuffle(pool).slice(0, 5)
}

function retryPicker() {
  pickedMovies.value = []
  noPickerMatches.value = false
}

export function useRandomPicker() {
  return {
    advancedOpen,
    pickerGenres,
    pickerDecades,
    pickerCountries,
    pickerDuration,
    pickerHideWatched,
    pickedMovies,
    noPickerMatches,
    togglePickerGenre,
    togglePickerDecade,
    togglePickerCountry,
    findMoviesToWatch,
    retryPicker,
  }
}
