<script setup lang="ts">
import { useMovieLibrary } from '../composables/useMovieLibrary'

const {
  byDecade,
  byDuration,
  byRating,
  topGenres,
  topDirectors,
  topCountries,
  maxDecadeCount,
  maxGenreCount,
  maxDirectorCount,
  maxCountryCount,
  maxDurationCount,
  maxRatingCount,
  abbreviateDirectorName,
} = useMovieLibrary()
</script>

<template>
  <section class="mb-11.5">
    <div class="mb-6.5 flex items-end justify-between">
      <div>
        <p class="mb-4.5 font-mono text-[11px] tracking-[0.12em] text-muted-1">BY THE NUMBERS</p>
        <h2>How the shelf breaks down.</h2>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-7.5 max-md:grid-cols-1">
      <div class="bg-cream p-6">
        <h3 class="mb-4 text-[13px] tracking-[-0.02em]">By decade</h3>
        <div v-for="[decade, count] in byDecade" :key="decade" class="mb-2.25 grid grid-cols-[90px_1fr_30px] items-center gap-2.5 font-mono text-[11px] text-muted-5">
          <span class="truncate">{{ decade }}s</span>
          <div class="h-2 bg-track">
            <div class="h-full bg-clay" :style="{ width: (count / maxDecadeCount) * 100 + '%' }"></div>
          </div>
          <span class="text-right text-muted-4">{{ count }}</span>
        </div>
      </div>
      <div class="bg-cream p-6">
        <h3 class="mb-4 text-[13px] tracking-[-0.02em]">Top genres</h3>
        <div v-for="[genre, count] in topGenres" :key="genre" class="mb-2.25 grid grid-cols-[90px_1fr_30px] items-center gap-2.5 font-mono text-[11px] text-muted-5">
          <span class="truncate">{{ genre }}</span>
          <div class="h-2 bg-track">
            <div class="h-full bg-clay" :style="{ width: (count / maxGenreCount) * 100 + '%' }"></div>
          </div>
          <span class="text-right text-muted-4">{{ count }}</span>
        </div>
      </div>
      <div class="bg-cream p-6">
        <h3 class="mb-4 text-[13px] tracking-[-0.02em]">Top directors</h3>
        <div v-for="[director, count] in topDirectors" :key="director" class="mb-2.25 grid grid-cols-[90px_1fr_30px] items-center gap-2.5 font-mono text-[11px] text-muted-5">
          <span class="truncate">{{ abbreviateDirectorName(director) }}</span>
          <div class="h-2 bg-track">
            <div class="h-full bg-clay" :style="{ width: (count / maxDirectorCount) * 100 + '%' }"></div>
          </div>
          <span class="text-right text-muted-4">{{ count }}</span>
        </div>
      </div>
      <div class="bg-cream p-6">
        <h3 class="mb-4 text-[13px] tracking-[-0.02em]">Top countries</h3>
        <div v-for="[country, count] in topCountries" :key="country" class="mb-2.25 grid grid-cols-[90px_1fr_30px] items-center gap-2.5 font-mono text-[11px] text-muted-5">
          <span class="truncate">{{ country }}</span>
          <div class="h-2 bg-track">
            <div class="h-full bg-clay" :style="{ width: (count / maxCountryCount) * 100 + '%' }"></div>
          </div>
          <span class="text-right text-muted-4">{{ count }}</span>
        </div>
      </div>
      <div class="bg-cream p-6">
        <h3 class="mb-4 text-[13px] tracking-[-0.02em]">By duration</h3>
        <div v-for="[bucket, count] in byDuration" :key="bucket" class="mb-2.25 grid grid-cols-[90px_1fr_30px] items-center gap-2.5 font-mono text-[11px] text-muted-5">
          <span class="truncate">{{ bucket }}</span>
          <div class="h-2 bg-track">
            <div class="h-full bg-clay" :style="{ width: (count / maxDurationCount) * 100 + '%' }"></div>
          </div>
          <span class="text-right text-muted-4">{{ count }}</span>
        </div>
      </div>
      <div class="bg-cream p-6">
        <h3 class="mb-4 text-[13px] tracking-[-0.02em]">By critic rating</h3>
        <div v-for="[bucket, count] in byRating" :key="bucket" class="mb-2.25 grid grid-cols-[90px_1fr_30px] items-center gap-2.5 font-mono text-[11px] text-muted-5">
          <span class="truncate">{{ bucket }}</span>
          <div class="h-2 bg-track">
            <div class="h-full bg-clay" :style="{ width: (count / maxRatingCount) * 100 + '%' }"></div>
          </div>
          <span class="text-right text-muted-4">{{ count }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
