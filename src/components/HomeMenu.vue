<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMovieLibrary } from '../composables/useMovieLibrary'
import { useView } from '../composables/useView'
import LibraryStats from './LibraryStats.vue'

const { goTo } = useView()
const { loadCollections } = useMovieLibrary()

const pickButtonRef = ref<HTMLElement | null>(null)
// Re-pulled on every visit home, for both the picker's filter and the list sync.
onMounted(() => {
  pickButtonRef.value?.focus()
  loadCollections()
})
</script>

<template>
  <section class="bg-cream px-10.5 py-6 max-md:p-6.5">
    <h2 class="mb-6">What's the plan tonight?</h2>
    <div class="mx-auto flex w-[70%] justify-between gap-6 max-md:w-full max-md:flex-col">
      <button
        ref="pickButtonRef"
        class="flex h-20 min-h-20 flex-1 cursor-pointer items-center justify-center border-0 bg-ink px-8 text-center text-2xl text-button-text"
        @click="goTo('pick')"
      >
        Pick a movie
      </button>
      <button
        class="flex h-20 min-h-20 flex-1 cursor-pointer items-center justify-center border border-ink bg-transparent px-8 text-center text-2xl text-ink"
        @click="goTo('stats')"
      >
        See stats
      </button>
      <button
        class="flex h-20 min-h-20 flex-1 cursor-pointer items-center justify-center border border-ink bg-transparent px-8 text-center text-2xl text-ink"
        @click="goTo('sync')"
      >
        Sync lists
      </button>
    </div>
  </section>
  <div class="mt-6">
    <LibraryStats />
  </div>
</template>
