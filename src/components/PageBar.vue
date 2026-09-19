<script setup lang="ts">
import { useView } from '../composables/useView'
import AccountMenu from './AccountMenu.vue'

const { goTo } = useView()
</script>

<template>
  <div class="flex items-center justify-between gap-4 pb-3">
    <button
      class="flex h-11 cursor-pointer items-center gap-2 border border-ink bg-transparent px-5 text-ink"
      @click="goTo('home')"
    >
      <span aria-hidden="true">←</span> Home
    </button>
    <AccountMenu />
  </div>
</template>
