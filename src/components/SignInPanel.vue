<script setup lang="ts">
import { useAsyncStatus } from '../composables/useAsyncStatus'
import { usePlexAuth } from '../composables/usePlexAuth'

const { loading, error } = useAsyncStatus()
const { signingIn, manualUrl, manualToken, startPlexSignIn, manualConnect } = usePlexAuth()
</script>

<template>
  <section class="mb-11.5 grid grid-cols-2 gap-[8vw] bg-panel p-9 max-md:grid-cols-1 max-md:gap-7 max-md:p-6.5">
    <div>
      <p class="mb-4.5 font-mono text-[11px] tracking-[0.12em] text-muted-1">REMOTE LIBRARY</p>
      <h2>Bring your shelf with you.</h2>
      <p class="max-w-120 leading-[1.55] text-muted-2">
        Sign in with your Plex account. This app never sees your password — plex.tv issues a token once you approve access, and your
        server is reached through Plex's own remote-access network, so this works from anywhere.
      </p>
    </div>
    <div class="grid content-start gap-3.5">
      <button
        class="col-span-full cursor-pointer border-0 bg-ink px-4.5 py-3.5 text-left text-button-text disabled:cursor-wait disabled:opacity-50"
        :disabled="signingIn"
        @click="startPlexSignIn"
      >
        {{ signingIn ? 'Waiting for approval…' : 'Sign in with Plex' }} <span class="float-right text-lg">↗</span>
      </button>
      <p v-if="signingIn" class="max-w-120 text-xs leading-[1.55] text-muted-2">
        A Plex tab just opened. Approve access there, then come back — this page updates on its own.
      </p>
      <p v-if="error" class="mt-0.75 font-mono text-xs text-error">{{ error }}</p>
      <details class="font-mono text-[11px] text-muted-3">
        <summary class="cursor-pointer text-ink">Connect manually instead</summary>
        <form class="mt-4 grid grid-cols-2 content-start gap-3.5 max-md:grid-cols-1" @submit.prevent="manualConnect">
          <label class="font-mono text-[11px] text-muted-3">
            Server URL
            <input v-model="manualUrl" type="url" placeholder="https://plex.example.com:32400" required />
          </label>
          <label class="font-mono text-[11px] text-muted-3">
            Token
            <input v-model="manualToken" type="password" placeholder="X-Plex-Token" required />
          </label>
          <button
            class="col-span-full cursor-pointer border-0 bg-ink px-4.5 py-3.5 text-left text-button-text disabled:cursor-wait disabled:opacity-50"
            :disabled="loading"
          >
            {{ loading ? 'Connecting…' : 'Connect' }} <span class="float-right text-lg">↗</span>
          </button>
        </form>
      </details>
    </div>
  </section>
</template>
