<script setup lang="ts">
import { useRouter } from 'vue-router'
import AccountMenu from './AccountMenu.vue'

// Five quick taps on the title open the hidden /debug page (the native app has no URL bar).
const router = useRouter()
let taps = 0
let tapTimer: ReturnType<typeof setTimeout> | undefined
function onTitleTap() {
  clearTimeout(tapTimer)
  if (++taps >= 5) {
    taps = 0
    void router.push('/debug')
    return
  }
  tapTimer = setTimeout(() => (taps = 0), 1500)
}
</script>

<template>
  <header class="flex items-start justify-between gap-5 pb-8 max-md:pb-6">
    <h1 class="m-0 text-[clamp(52px,7vw,90px)] leading-[0.88] font-semibold tracking-[-0.07em] select-none" @click="onTitleTap">
      <!-- On phones "Pick" gets its own line so the status/account menu fits beside it. -->
      Pick <br class="tablet:hidden" />something<br /><em class="font-serif font-bold text-clay italic">excellent.</em>
    </h1>
    <div class="flex h-11 items-center">
      <AccountMenu />
    </div>
  </header>
</template>
