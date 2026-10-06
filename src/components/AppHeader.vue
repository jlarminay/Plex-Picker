<script setup lang="ts">
import AccountMenu from './AccountMenu.vue'
</script>

<template>
  <header class="flex items-start justify-between gap-5 pb-8 max-md:pb-6">
    <h1 class="m-0 text-[clamp(52px,7vw,90px)] leading-[0.88] font-semibold tracking-[-0.07em]">
      <!-- On phones "Pick" gets its own line so the status/account menu fits beside it. -->
      Pick <br class="tablet:hidden" />something<br /><em class="font-serif font-bold text-clay italic">excellent.</em>
    </h1>
    <div class="flex h-11 items-center">
      <AccountMenu />
    </div>
  </header>
</template>
