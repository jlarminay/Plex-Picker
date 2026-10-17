<script setup lang="ts">
import { goHome } from '../router'
import AccountMenu from './AccountMenu.vue'

</script>

<template>
  <div class="flex items-center justify-between gap-4 pb-3">
    <button
      class="flex h-11 cursor-pointer items-center gap-2 border border-ink bg-transparent px-5 text-ink"
      @click="goHome()"
    >
      <span aria-hidden="true">←</span> Home
    </button>
    <AccountMenu />
  </div>
</template>
