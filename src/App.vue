<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { installDpadNavigation } from './lib/dpadNav'
import AppHeader from './components/AppHeader.vue'
import SignInPanel from './components/SignInPanel.vue'
import ServerPicker from './components/ServerPicker.vue'
import RandomPicker from './components/RandomPicker.vue'
import LibraryStats from './components/LibraryStats.vue'
import LibraryAnalytics from './components/LibraryAnalytics.vue'
// import MovieGrid from './components/MovieGrid.vue' // disabled: duplicates Plex's own browsing UI
// import EmptyState from './components/EmptyState.vue' // disabled: nothing shown below the sign-in box for now
import { usePlexAuth } from './composables/usePlexAuth'

const { account, connected, refreshStatus } = usePlexAuth()

onMounted(refreshStatus)

const stopDpadNavigation = installDpadNavigation()
onBeforeUnmount(stopDpadNavigation)
</script>

<template>
  <main class="mx-auto max-w-305 px-[5vw] pt-10.5 pb-20 max-md:px-5.5 max-md:pt-6.5 max-md:pb-15">
    <AppHeader />

    <SignInPanel v-if="!account" />
    <ServerPicker v-else-if="!connected" />

    <template v-if="connected">
      <RandomPicker />
      <LibraryStats />
      <LibraryAnalytics />
      <!-- <MovieGrid /> disabled: duplicates Plex's own browsing UI -->
    </template>

    <!-- <EmptyState v-if="!account" /> disabled: nothing shown below the sign-in box for now -->
  </main>
</template>
