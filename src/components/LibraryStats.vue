<script setup lang="ts">
import { useMovieLibrary } from '../composables/useMovieLibrary'

const { movies, stats } = useMovieLibrary()
</script>

<template>
  <section class="my-10.5 grid grid-cols-4 border-b border-border-4 max-md:grid-cols-2 max-md:gap-y-5.5">
    <div class="mr-5.5 border-r border-border-4 pr-5.5 pb-5">
      <strong class="block text-[32px] tracking-[-0.06em]">{{ movies.length }}</strong>
      <span class="font-mono text-[11px] text-muted-4">films in library</span>
    </div>
    <div class="mr-5.5 border-r border-border-4 pr-5.5 pb-5 max-md:border-0">
      <strong class="block text-[32px] tracking-[-0.06em]">{{ stats.years }}</strong>
      <span class="font-mono text-[11px] text-muted-4">release years</span>
    </div>
    <div class="mr-5.5 border-r border-border-4 pr-5.5 pb-5">
      <strong class="block text-[32px] tracking-[-0.06em]">{{ stats.genres }}</strong>
      <span class="font-mono text-[11px] text-muted-4">genres</span>
    </div>
    <div class="pb-5">
      <strong class="block text-[32px] tracking-[-0.06em]">{{ stats.directors }}</strong>
      <span class="font-mono text-[11px] text-muted-4">directors</span>
    </div>
  </section>
</template>
