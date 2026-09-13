import { computed, ref } from 'vue'
import { getSession, updateSession, type SelectedServer } from '../lib/localSession'
import { authUrlForPin, checkPin, createPin, getAccount, getServers, resolveConnection, verifyManualConnection, type PlexResource } from '../lib/plex'
import { useAsyncStatus } from './useAsyncStatus'
import { useMovieLibrary } from './useMovieLibrary'

export type Account = { username: string; email: string; thumb: string | null }

const { loading, error } = useAsyncStatus()
const { loadMovies, resetMovies } = useMovieLibrary()

const account = ref<Account | null>(null)
const servers = ref<PlexResource[]>([])
const connectedServer = ref<{ name: string; clientIdentifier: string } | null>(null)
const signingIn = ref(false)
const manualUrl = ref('')
const manualToken = ref('')

let pollTimer: ReturnType<typeof setInterval> | undefined
let pollDeadline = 0

const connected = computed(() => Boolean(connectedServer.value))

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = undefined
  signingIn.value = false
}

async function refreshStatus() {
  const session = getSession()
  account.value = session.account
  connectedServer.value = session.server ? { name: session.server.name, clientIdentifier: session.server.clientIdentifier } : null
  if (session.authToken) {
    try {
      servers.value = await getServers(session.authToken)
    } catch {
      // plex.tv unreachable right now; the client can retry
    }
  }
  if (session.server) {
    try {
      await loadMovies()
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'Unable to load your library.'
    }
  }
}

async function startPlexSignIn() {
  error.value = ''
  try {
    const pin = await createPin()
    window.open(authUrlForPin(pin), '_blank', 'noopener')
    signingIn.value = true
    pollDeadline = Date.now() + 2 * 60 * 1000
    pollTimer = setInterval(() => pollPin(pin.id), 2000)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to start Plex sign-in.'
  }
}

async function pollPin(id: number) {
  if (Date.now() > pollDeadline) {
    stopPolling()
    error.value = 'Sign-in timed out. Try again.'
    return
  }
  try {
    const pin = await checkPin(id)
    if (!pin.authToken) return
    stopPolling()
    const acct = await getAccount(pin.authToken)
    updateSession({ authToken: pin.authToken, account: acct })
    account.value = acct
    servers.value = await getServers(pin.authToken)
    if (servers.value.length === 1) await selectServer(servers.value[0].clientIdentifier)
  } catch (reason) {
    stopPolling()
    error.value = reason instanceof Error ? reason.message : 'Sign-in failed.'
  }
}

async function selectServer(clientIdentifier: string) {
  loading.value = true
  error.value = ''
  try {
    const resource = servers.value.find((server) => server.clientIdentifier === clientIdentifier)
    if (!resource) throw new Error('Unknown server. Refresh the server list and try again.')
    const uri = await resolveConnection(resource)
    const serverInfo: SelectedServer = { name: resource.name, clientIdentifier: resource.clientIdentifier, uri, accessToken: resource.accessToken }
    updateSession({ server: serverInfo })
    connectedServer.value = { name: serverInfo.name, clientIdentifier: serverInfo.clientIdentifier }
    await loadMovies()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to connect to that server.'
  } finally {
    loading.value = false
  }
}

async function manualConnect() {
  loading.value = true
  error.value = ''
  try {
    const uri = manualUrl.value.trim().replace(/\/$/, '')
    const accessToken = manualToken.value.trim()
    if (!uri || !accessToken) throw new Error('Server URL and token are required.')
    await verifyManualConnection(uri, accessToken)
    const serverInfo: SelectedServer = { name: 'Manual server', clientIdentifier: 'manual', uri, accessToken }
    updateSession({ server: serverInfo })
    connectedServer.value = { name: serverInfo.name, clientIdentifier: serverInfo.clientIdentifier }
    manualToken.value = ''
    await loadMovies()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Connection failed.'
  } finally {
    loading.value = false
  }
}

function logout() {
  updateSession({ authToken: null, account: null, server: null })
  account.value = null
  servers.value = []
  connectedServer.value = null
  resetMovies()
}

export function usePlexAuth() {
  return {
    account,
    servers,
    connectedServer,
    connected,
    signingIn,
    manualUrl,
    manualToken,
    refreshStatus,
    startPlexSignIn,
    selectServer,
    manualConnect,
    logout,
  }
}
