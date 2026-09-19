<script setup lang="ts">
import { useMovieLibrary } from '../composables/useMovieLibrary'

const { movies, stats } = useMovieLibrary()

const items = () => [
  { value: movies.value.length, label: 'films in library' },
  { value: stats.value.years, label: 'release years' },
  { value: stats.value.genres, label: 'genres' },
  { value: stats.value.directors, label: 'directors' },
  { value: stats.value.countries, label: 'countries' },
]
</script>

<template>
  <section class="grid grid-cols-5 gap-y-6 bg-cream px-10.5 py-6 max-md:p-6.5 text-center max-md:grid-cols-2">
    <div v-for="item in items()" :key="item.label">
      <strong class="block text-[32px] tracking-[-0.06em]">{{ item.value }}</strong>
      <span class="font-mono text-[11px] text-muted-4">{{ item.label }}</span>
    </div>
  </section>
</template>
