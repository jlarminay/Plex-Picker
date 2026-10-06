<script setup lang="ts">
import { useMovieLibrary } from '../composables/useMovieLibrary'

const { stats } = useMovieLibrary()

const items = () => [
  { value: stats.value.years, label: 'release years' },
  { value: stats.value.genres, label: 'genres' },
  { value: stats.value.directors, label: 'directors' },
  { value: stats.value.countries, label: 'countries' },
]
</script>

<template>
  <section class="grid grid-cols-4 gap-y-6 bg-cream px-10.5 py-6 max-md:p-6.5 text-center max-md:grid-cols-2">
    <div v-for="item in items()" :key="item.label">
      <strong class="block -mb-1 text-[32px] leading-none tracking-[-0.06em]">{{ item.value }}</strong>
      <span class="font-mono text-[11px] text-muted-4">{{ item.label }}</span>
    </div>
  </section>
</template>
