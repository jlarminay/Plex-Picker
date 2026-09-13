<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAsyncStatus } from '../composables/useAsyncStatus'
import { useMovieLibrary } from '../composables/useMovieLibrary'
import { usePlexAuth } from '../composables/usePlexAuth'

const { loading } = useAsyncStatus()
const { movies, refreshLibrary } = useMovieLibrary()
const { account, connected, logout } = usePlexAuth()

const busy = computed(() => loading.value)
const statusText = computed(() => {
  if (loading.value) return connected.value ? 'Refreshing…' : 'Connecting…'
  if (connected.value) return `${movies.value.length} films indexed`
  return account.value ? 'Choose a server' : 'Not connected'
})

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const avatarButtonRef = ref<HTMLElement | null>(null)

function onWindowClick(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) menuOpen.value = false
}

// Navigating past the last item closes the menu instead of leaving it open
// while focus jumps off to something unrelated further down the page.
function onDropdownKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown') return
  const container = event.currentTarget as HTMLElement
  const items = Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled])'))
  const last = items[items.length - 1]
  if (document.activeElement !== last) return
  event.preventDefault()
  event.stopPropagation()
  menuOpen.value = false
  avatarButtonRef.value?.focus()
}

onMounted(() => window.addEventListener('click', onWindowClick))
onBeforeUnmount(() => window.removeEventListener('click', onWindowClick))

async function onRefresh() {
  menuOpen.value = false
  await refreshLibrary()
}

async function onLogout() {
  menuOpen.value = false
  await logout()
}
</script>

<template>
  <header class="flex items-start justify-between gap-5 pb-13 max-md:pb-9.5">
    <h1 class="m-0 text-[clamp(52px,8vw,105px)] leading-[0.88] font-semibold tracking-[-0.07em]">
      Pick something<br /><em class="font-serif font-bold text-clay italic">excellent.</em>
    </h1>
    <div class="grid gap-2.5 justify-items-end text-right max-md:justify-items-start max-md:text-left">
      <div class="flex items-center gap-3.5">
        <div class="flex items-center rounded-full border border-border-1 px-3.75 py-2.5 font-mono text-[11px] whitespace-nowrap text-muted-1">
          <span
            v-if="busy"
            class="mr-2 inline-block h-1.75 w-1.75 animate-spin rounded-full border border-muted-1 border-t-transparent"
          ></span>
          <span v-else class="mr-2 inline-block h-1.75 w-1.75 rounded-full" :class="connected ? 'bg-live' : 'bg-border-3'"></span>
          {{ statusText }}
        </div>
        <div v-if="account" ref="menuRef" class="relative">
          <button
            ref="avatarButtonRef"
            class="grid h-8.5 w-8.5 cursor-pointer place-items-center overflow-hidden rounded-full border border-border-1 bg-panel p-0 font-mono text-xs font-medium text-ink"
            @click.stop="menuOpen = !menuOpen"
          >
            <img v-if="account.thumb" :src="account.thumb" :alt="account.username" class="h-full w-full object-cover" />
            <span v-else>{{ account.username.slice(0, 1).toUpperCase() }}</span>
          </button>
          <div
            v-if="menuOpen"
            class="absolute top-[calc(100%+10px)] right-0 z-20 grid min-w-47.5 gap-0.5 border border-border-4 bg-cream p-2 text-left"
            @keydown="onDropdownKeydown"
          >
            <p class="m-0 px-2.5 pt-2 pb-1.5 font-mono text-[11px] text-muted-4">{{ account.username }}</p>
            <button v-if="connected" class="cursor-pointer border-0 bg-transparent p-2.5 text-left text-ink hover:bg-black/5" :disabled="loading" @click="onRefresh">
              {{ loading ? 'Refreshing…' : 'Refresh library' }}
            </button>
            <button class="cursor-pointer border-0 bg-transparent p-2.5 text-left text-ink hover:bg-black/5" @click="onLogout">Sign out</button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
