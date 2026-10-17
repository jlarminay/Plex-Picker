<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMovieLibrary } from '../composables/useMovieLibrary'
import { plexRawGet } from '../lib/plex'

// Hidden page (/debug): shows exactly what the Plex server returns, and checks
// a collection's real contents against the collection tags the picker filters on.

const { movies, collections, loadCollections } = useMovieLibrary()

type Item = { ratingKey?: string | number; title?: string | number; year?: number; Collection?: Array<{ tag?: string }> | { tag?: string } }
const asArray = <T,>(value: T | T[] | undefined): T[] => (value ? (Array.isArray(value) ? value : [value]) : [])
const tagsOf = (item: Item | undefined) => asArray(item?.Collection).map((entry) => String(entry.tag ?? ''))
const videosOf = (parsed: unknown) => asArray((parsed as { MediaContainer?: { Video?: Item | Item[] } })?.MediaContainer?.Video)

// ---- Collection check ----

const collectionKey = ref('')
const checking = ref(false)
const checkError = ref('')
type MissingRow = { ratingKey: string; label: string; listTags: string[]; appTags: string[] | null; fullTags: string[] }
const check = ref<{ title: string; inCollection: number; taggedInList: number; taggedInApp: number; missing: MissingRow[] } | null>(null)

const selected = computed(() => collections.value.find((collection) => collection.ratingKey === collectionKey.value))

async function runCheck() {
  const collection = selected.value
  if (!collection || checking.value) return
  checking.value = true
  checkError.value = ''
  check.value = null
  try {
    const [children, all] = await Promise.all([
      plexRawGet(`/library/collections/${collection.ratingKey}/children`),
      plexRawGet(`/library/sections/${collection.sectionKey}/all?includeGuids=1`),
    ])
    const members = videosOf(children.parsed)
    const listed = new Map(videosOf(all.parsed).map((item) => [String(item.ratingKey), item]))
    const appByKey = new Map(movies.value.map((movie) => [movie.ratingKey, movie]))

    const taggedInList = [...listed.values()].filter((item) => tagsOf(item).includes(collection.title)).length
    const taggedInApp = movies.value.filter((movie) => movie.collections.includes(collection.title)).length

    const missingItems = members.filter((item) => !appByKey.get(String(item.ratingKey))?.collections.includes(collection.title))
    const missing: MissingRow[] = []
    // A few at a time, so a big gap doesn't flood the server.
    for (let i = 0; i < missingItems.length; i += 8) {
      const batch = missingItems.slice(i, i + 8)
      const full = await Promise.all(batch.map((item) => plexRawGet(`/library/metadata/${item.ratingKey}`)))
      batch.forEach((item, index) => {
        const key = String(item.ratingKey)
        missing.push({
          ratingKey: key,
          label: item.year ? `${item.title} (${item.year})` : String(item.title),
          listTags: tagsOf(listed.get(key)),
          appTags: appByKey.get(key)?.collections ?? null,
          fullTags: tagsOf(videosOf(full[index].parsed)[0]),
        })
      })
    }
    check.value = { title: collection.title, inCollection: members.length, taggedInList, taggedInApp, missing }
  } catch (reason) {
    checkError.value = reason instanceof Error ? reason.message : 'Check failed.'
  } finally {
    checking.value = false
  }
}

// ---- Raw request ----

const presets = computed(() => [
  { label: 'Libraries', path: '/library/sections' },
  ...(selected.value
    ? [
        { label: 'Section: all movies', path: `/library/sections/${selected.value.sectionKey}/all?includeGuids=1` },
        { label: 'Section: collections', path: `/library/sections/${selected.value.sectionKey}/collections` },
        { label: `“${selected.value.title}” items`, path: `/library/collections/${selected.value.ratingKey}/children` },
      ]
    : []),
  { label: 'Server', path: '/' },
])

const path = ref('/library/sections')
const showXml = ref(false)
const fetching = ref(false)
const response = ref<{ path: string; status: number; text: string; parsed: unknown; ms: number } | null>(null)
const fetchError = ref('')

async function runFetch(target = path.value) {
  path.value = target
  fetching.value = true
  fetchError.value = ''
  const started = performance.now()
  try {
    const result = await plexRawGet(target)
    response.value = { path: target, ...result, ms: Math.round(performance.now() - started) }
  } catch (reason) {
    fetchError.value = reason instanceof Error ? reason.message : 'Request failed.'
  } finally {
    fetching.value = false
  }
}

const pretty = computed(() => (response.value ? (showXml.value ? response.value.text : JSON.stringify(response.value.parsed, null, 2)) : ''))
const kb = (text: string) => `${(new Blob([text]).size / 1024).toFixed(1)} KB`

onMounted(async () => {
  if (!collections.value.length) await loadCollections()
  collectionKey.value = collections.value.find((collection) => collection.title.toLowerCase() === 'to watch')?.ratingKey ?? collections.value[0]?.ratingKey ?? ''
})
</script>

<template>
  <section class="bg-cream px-10.5 py-6 max-md:p-6.5">
    <h2>Plex debug</h2>
    <p class="mb-5 font-mono text-xs text-muted-5">
      Compares a collection's real contents with the collection tags the picker filters on.
    </p>

    <div class="grid grid-cols-[1fr_auto] items-end gap-6 max-tablet:grid-cols-1 max-tablet:gap-4">
      <div class="grid gap-2.5">
        <p class="m-0 font-mono text-[11px] text-muted-3">Collection</p>
        <select v-model="collectionKey" :disabled="checking">
          <option v-for="collection in collections" :key="collection.ratingKey" :value="collection.ratingKey">{{ collection.title }}</option>
        </select>
      </div>
      <button
        class="flex h-14 cursor-pointer items-center justify-center border-0 bg-ink px-6 text-button-text aria-disabled:cursor-wait aria-disabled:opacity-50"
        :aria-disabled="checking || !selected"
        @click="runCheck()"
      >
        {{ checking ? 'Checking…' : 'Check collection' }}
      </button>
    </div>
    <p v-if="checkError" class="mt-5 mb-0 font-mono text-xs text-error">{{ checkError }}</p>

    <template v-if="check">
      <div class="mt-6 grid grid-cols-3 gap-y-6 text-center max-md:grid-cols-1">
        <div>
          <strong class="block text-[32px] tracking-[-0.06em]">{{ check.inCollection }}</strong>
          <span class="font-mono text-[11px] text-muted-4">in the Plex collection</span>
        </div>
        <div>
          <strong class="block text-[32px] tracking-[-0.06em]">{{ check.taggedInList }}</strong>
          <span class="font-mono text-[11px] text-muted-4">tagged in a fresh /all fetch</span>
        </div>
        <div>
          <strong class="block text-[32px] tracking-[-0.06em]">{{ check.taggedInApp }}</strong>
          <span class="font-mono text-[11px] text-muted-4">tagged in the app's loaded library</span>
        </div>
      </div>

      <div v-if="check.missing.length" class="mt-6 overflow-x-auto">
        <h3 class="mt-0">Missing from the picker ({{ check.missing.length }})</h3>
        <table class="w-full border-collapse font-mono text-xs">
          <thead>
            <tr class="text-left text-muted-3">
              <th class="border-b border-border-1 py-2 pr-4">Movie</th>
              <th class="border-b border-border-1 py-2 pr-4">Tags in fresh /all</th>
              <th class="border-b border-border-1 py-2 pr-4">Tags in app</th>
              <th class="border-b border-border-1 py-2">Tags on full item</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in check.missing" :key="row.ratingKey" tabindex="0" class="align-top">
              <td class="border-b border-border-4 py-2 pr-4">{{ row.label }}</td>
              <td class="border-b border-border-4 py-2 pr-4">{{ row.listTags.join(', ') || '—' }}</td>
              <td class="border-b border-border-4 py-2 pr-4">{{ row.appTags === null ? 'not in library' : row.appTags.join(', ') || '—' }}</td>
              <td class="border-b border-border-4 py-2">{{ row.fullTags.join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="mt-6 mb-0 font-mono text-xs text-muted-5">Every movie in “{{ check.title }}” is tagged in the app's library.</p>
    </template>
  </section>

  <section class="mt-6 bg-cream px-10.5 py-6 max-md:p-6.5">
    <h2>Raw request</h2>
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="preset in presets"
        :key="preset.path"
        class="cursor-pointer border border-ink bg-transparent px-3 py-2 font-mono text-xs text-ink"
        @click="runFetch(preset.path)"
      >
        {{ preset.label }}
      </button>
    </div>
    <form class="flex gap-3 max-tablet:flex-col" @submit.prevent="runFetch()">
      <input v-model="path" class="min-w-0 flex-1 border border-border-2 bg-paper px-3 py-3 font-mono text-xs" spellcheck="false" />
      <button class="cursor-pointer border-0 bg-ink px-6 py-3 text-button-text" type="submit">{{ fetching ? 'Fetching…' : 'GET' }}</button>
    </form>
    <p v-if="fetchError" class="mt-4 mb-0 font-mono text-xs text-error">{{ fetchError }}</p>

    <template v-if="response">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-muted-4">
        <span>{{ response.path }} · {{ response.status }} · {{ kb(response.text) }} · {{ response.ms }} ms</span>
        <label class="flex items-center gap-2"><input v-model="showXml" type="checkbox" /> raw XML</label>
      </div>
      <pre class="mt-3 max-h-[70vh] overflow-auto bg-paper p-4 font-mono text-[11px] leading-normal whitespace-pre-wrap break-all">{{ pretty }}</pre>
    </template>
  </section>
</template>
