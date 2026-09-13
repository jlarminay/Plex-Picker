<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useMovieLibrary } from '../composables/useMovieLibrary'
import MovieCard from './MovieCard.vue'

const { genres, filtered, sorted, visibleMovies, sortBy, sortDir, query, filter, loadMore } = useMovieLibrary()

const sentinel = ref<HTMLElement | null>(null)
let scrollObserver: IntersectionObserver | undefined

watch(sentinel, (el, previousEl) => {
  if (previousEl) scrollObserver?.unobserve(previousEl)
  if (!el) return
  if (!scrollObserver) {
    scrollObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && visibleMovies.value.length < sorted.value.length) loadMore()
    })
  }
  scrollObserver.observe(el)
})

onBeforeUnmount(() => scrollObserver?.disconnect())
</script>

<template>
  <section>
    <div class="mb-6.5 flex items-end justify-between max-md:flex-col max-md:items-start max-md:gap-5">
      <div>
        <p class="mb-4.5 font-mono text-[11px] tracking-[0.12em] text-muted-1">THE COLLECTION</p>
        <h2>All movies</h2>
      </div>
      <div class="flex w-[min(720px,60%)] flex-wrap gap-x-5.5 gap-y-3.5 max-md:w-full">
        <input v-model="query" placeholder="Search titles, genres…" class="flex-[1_1_200px]" />
        <select v-model="filter" class="w-auto flex-[1_1_150px]">
          <option value="all">All genres</option>
          <option v-for="genre in genres" :key="genre" :value="genre">{{ genre }}</option>
        </select>
        <select v-model="sortBy" class="w-auto flex-[1_1_150px]">
          <option value="added">Recently added</option>
          <option value="release">Release date</option>
          <option value="title">Alphabetical</option>
          <option value="duration">Duration</option>
        </select>
        <button
          type="button"
          class="w-9.5 flex-none cursor-pointer border border-border-2 bg-transparent p-0 text-[15px] text-ink"
          :title="sortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'"
          @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
        >
          {{ sortDir === 'asc' ? '↑' : '↓' }}
        </button>
      </div>
    </div>
    <p v-if="filtered.length" class="mb-4 max-w-120 text-xs leading-[1.55] text-muted-2">Showing {{ visibleMovies.length }} of {{ filtered.length }}</p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4 md:gap-x-3.5 md:gap-y-5.5 lg:grid-cols-6">
      <MovieCard v-for="movie in visibleMovies" :key="movie.title + movie.year" :movie="movie" variant="grid" />
    </div>
    <div v-if="visibleMovies.length < filtered.length" ref="sentinel" class="h-px"></div>
    <p v-if="!filtered.length" class="py-20 text-center text-xl text-muted-4">No movies match that search.</p>
  </section>
</template>
