<script setup lang="ts">
import { useAsyncStatus } from '../composables/useAsyncStatus'
import { usePlexAuth } from '../composables/usePlexAuth'

const { loading, error } = useAsyncStatus()
const { account, servers, selectServer, refreshStatus } = usePlexAuth()
</script>

<template>
  <section class="mb-11.5 grid grid-cols-2 gap-[8vw] bg-panel p-9 max-md:grid-cols-1 max-md:gap-7 max-md:p-6.5">
    <div>
      <p class="mb-4.5 font-mono text-[11px] tracking-[0.12em] text-muted-1">CHOOSE A SERVER</p>
      <h2>Which library?</h2>
      <p class="max-w-120 leading-[1.55] text-muted-2">Signed in as {{ account?.username }}. Pick the Plex Media Server to index.</p>
      <p v-if="error" class="mt-0.75 font-mono text-xs text-error">{{ error }}</p>
    </div>
    <div class="grid content-start gap-3">
      <button
        v-for="server in servers"
        :key="server.clientIdentifier"
        class="w-full cursor-pointer border-0 bg-ink px-4.5 py-3.5 text-left text-button-text disabled:cursor-wait disabled:opacity-50"
        :disabled="loading"
        @click="selectServer(server.clientIdentifier)"
      >
        {{ loading ? 'Connecting…' : server.name }} <span class="float-right text-lg">↗</span>
      </button>
      <p v-if="!servers.length" class="max-w-120 text-xs leading-[1.55] text-muted-2">
        No servers found on this account yet.
        <button class="cursor-pointer border-0 bg-transparent p-0 text-clay underline" @click="refreshStatus">Refresh</button>
      </p>
    </div>
  </section>
</template>
