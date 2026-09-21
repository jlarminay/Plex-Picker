<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { installDpadNavigation } from './lib/dpadNav'
import AppHeader from './components/AppHeader.vue'
import SignInPanel from './components/SignInPanel.vue'
import ServerPicker from './components/ServerPicker.vue'
import HomeMenu from './components/HomeMenu.vue'
import PageBar from './components/PageBar.vue'
import RandomPicker from './components/RandomPicker.vue'
import LibraryAnalytics from './components/LibraryAnalytics.vue'
// import MovieGrid from './components/MovieGrid.vue' // disabled: duplicates Plex's own browsing UI
// import EmptyState from './components/EmptyState.vue' // disabled: nothing shown below the sign-in box for now
import { usePlexAuth } from './composables/usePlexAuth'
import { useView } from './composables/useView'

const { account, connected, refreshStatus } = usePlexAuth()
const { view } = useView()
const scrolls = computed(() => connected.value && view.value === 'stats')

onMounted(refreshStatus)

const stopDpadNavigation = installDpadNavigation()
onBeforeUnmount(stopDpadNavigation)
</script>

<template>
  <main
    class="mx-auto flex max-w-305 flex-col px-[5vw] pt-7.5 max-md:px-5.5 max-md:pt-6.5"
    :class="
      scrolls
        ? 'min-h-[calc(100vh/0.9)] pb-10 max-md:pb-8'
        : 'h-[calc(100vh/0.9)] overflow-y-auto pb-6 max-md:pb-5'
    "
  >
    <template v-if="!connected || view === 'home'">
      <AppHeader />
      <SignInPanel v-if="!account" />
      <ServerPicker v-else-if="!connected" />
      <HomeMenu v-else />
    </template>

    <template v-else-if="view === 'pick'">
      <PageBar />
      <RandomPicker />
    </template>

    <template v-else>
      <PageBar />
      <LibraryAnalytics />
    </template>
  </main>
</template>
