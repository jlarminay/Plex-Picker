<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { letterboxdLists } from '../config/letterboxdLists'
import { NEW_COLLECTION, useListSync } from '../composables/useListSync'
import { useMovieLibrary } from '../composables/useMovieLibrary'

const { running, progress, syncError, result, runSync } = useListSync()
const { collections, collectionsLoading, collectionsError } = useMovieLibrary()

const listIndex = ref(0)
const collectionKey = ref('')
const listSelectRef = ref<HTMLElement | null>(null)

const selectedList = computed(() => letterboxdLists[listIndex.value] ?? null)
const busy = computed(() => running.value || collectionsLoading.value)
const status = computed(() => progress.value || (collectionsLoading.value ? 'Loading your Plex collections…' : ''))

// Default the collection to one named like the list, else offer a new one.
function pickDefaultCollection() {
  const name = selectedList.value?.name.toLowerCase()
  collectionKey.value = collections.value.find((collection) => collection.title.toLowerCase() === name)?.ratingKey ?? NEW_COLLECTION
}
watch([listIndex, collections], pickDefaultCollection)

// The collection list itself is loaded by the home page.
onMounted(() => {
  listSelectRef.value?.focus()
  pickDefaultCollection()
})

async function run() {
  if (!selectedList.value || busy.value) return
  await runSync(selectedList.value, collectionKey.value)
  await nextTick()
  document.getElementById('sync-results')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

const seconds = (ms: number) => (ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`)
const label = (title: string, year: number | null) => (year ? `${title} (${year})` : title)

const inSync = computed(
  () => Boolean(result.value && !result.value.missing.length && !result.value.added.length && !result.value.removed.length && !result.value.note),
)
// The counts sit in the summary row; this panel is only for films that need a look.
const hasDetails = computed(
  () =>
    Boolean(result.value) &&
    (inSync.value || Boolean(result.value!.note) || [result.value!.missing, result.value!.matchedByTitle, result.value!.unverified].some((list) => list.length)),
)

const summary = computed(() =>
  result.value
    ? [
        { value: seconds(result.value.durationMs), label: 'time taken' },
        { value: result.value.listCount, label: 'films on list' },
        { value: result.value.added.length, label: 'added' },
        { value: result.value.removed.length, label: 'removed' },
        { value: result.value.missing.length, label: 'not on server' },
      ]
    : [],
)
</script>

<template>
  <section class="bg-cream px-10.5 py-6 max-md:p-6.5">
    <h2>Sync a Letterboxd list</h2>
    <p class="mb-5 font-mono text-xs text-muted-5">
      The Plex collection is changed to match the Letterboxd list exactly.
    </p>

    <p v-if="!letterboxdLists.length" class="font-mono text-xs text-error">
      No Letterboxd lists set up yet — add them in src/config/letterboxdLists.ts.
    </p>

    <template v-else>
      <div class="grid grid-cols-[1fr_1fr_auto] items-end gap-6 max-tablet:grid-cols-1 max-tablet:gap-4">
        <div class="grid gap-2.5">
          <p class="m-0 font-mono text-[11px] text-muted-3">Letterboxd list</p>
          <select ref="listSelectRef" v-model.number="listIndex" :disabled="running">
            <option v-for="(list, index) in letterboxdLists" :key="list.url" :value="index">{{ list.name }}</option>
          </select>
        </div>
        <div class="grid gap-2.5">
          <p class="m-0 font-mono text-[11px] text-muted-3">Plex collection</p>
          <select v-model="collectionKey" :disabled="running || collectionsLoading">
            <option v-if="collectionsLoading" :value="collectionKey">Loading collections…</option>
            <template v-else>
              <option :value="NEW_COLLECTION">New collection: {{ selectedList?.name }}</option>
              <option v-for="collection in collections" :key="collection.ratingKey" :value="collection.ratingKey">
                {{ collection.title }}
              </option>
            </template>
          </select>
        </div>
        <button
          class="flex h-14 w-auto cursor-pointer items-center justify-center border-0 bg-ink px-6 py-4 text-button-text aria-disabled:cursor-wait aria-disabled:opacity-50"
          :aria-disabled="busy"
          @click="!busy && run()"
        >
          {{ running ? 'Syncing…' : 'Run sync' }}
        </button>
      </div>
      <p v-if="status" class="mt-5 mb-0 text-center font-mono text-xs text-muted-5">{{ status }}</p>
      <p v-if="syncError || collectionsError" class="mt-5 mb-0 text-center font-mono text-xs text-error">{{ syncError || collectionsError }}</p>
    </template>
  </section>

  <!-- Result rows are focusable so a TV remote's D-pad can scroll through long lists. -->
  <template v-if="result">
    <section id="sync-results" class="mt-6 grid grid-cols-5 gap-y-6 bg-cream px-10.5 py-6 text-center max-md:grid-cols-2 max-md:p-6.5">
      <div v-for="item in summary" :key="item.label">
        <strong class="block text-[32px] tracking-[-0.06em]">{{ item.value }}</strong>
        <span class="font-mono text-[11px] text-muted-4">{{ item.label }}</span>
      </div>
    </section>

    <section v-if="hasDetails" class="mt-6 grid gap-6 bg-cream px-10.5 py-6 max-md:p-6.5">
      <p v-if="result.note" class="m-0 font-mono text-xs text-error">{{ result.note }}</p>

      <div v-if="result.missing.length" class="grid gap-2">
        <h3 class="m-0">Not on your server</h3>
        <ul class="m-0 grid gap-1 pl-5">
          <li tabindex="0" v-for="film in result.missing" :key="film.slug">{{ label(film.title, film.year) }}</li>
        </ul>
      </div>

      <div v-if="result.matchedByTitle.length" class="grid gap-2">
        <h3 class="m-0">Matched by title — worth a check</h3>
        <ul class="m-0 grid gap-1 pl-5">
          <li tabindex="0" v-for="{ film, movie } in result.matchedByTitle" :key="film.slug">
            {{ label(film.title, film.year) }} → {{ label(movie.title, movie.year) }}
          </li>
        </ul>
      </div>

      <div v-if="result.unverified.length" class="grid gap-2">
        <h3 class="m-0">Left in the collection — couldn't confirm</h3>
        <ul class="m-0 grid gap-1 pl-5">
          <li tabindex="0" v-for="movie in result.unverified" :key="movie.ratingKey ?? movie.title">{{ label(movie.title, movie.year) }}</li>
        </ul>
      </div>

      <p v-if="inSync" class="m-0 font-mono text-xs text-muted-5">
        Already in sync — nothing to change.
      </p>
    </section>
  </template>
</template>
