import { AppLauncher } from '@capacitor/app-launcher'
import { Capacitor } from '@capacitor/core'
import type { Movie } from '../composables/useMovieLibrary'
import { getSession } from './localSession'

export function canOpenInPlex(movie: Movie): boolean {
  const session = getSession()
  return Boolean(movie.ratingKey && session.server && session.authToken)
}

const slugCache = new Map<string, string>()

// plex:// library links always auto-play, so open the movie's Plex Discover
// details page instead (https://watch.plex.tv/movie/<slug>), which the Plex app
// claims. The slug comes from the item's plex:// guid via Plex's metadata service.
async function lookupSlug(ratingKey: string): Promise<string> {
  const cached = slugCache.get(ratingKey)
  if (cached) return cached
  const { server, authToken } = getSession()
  if (!server || !authToken) throw new Error('Not signed in')

  const local = await fetch(
    `${server.uri.replace(/\/$/, '')}/library/metadata/${ratingKey}?X-Plex-Token=${encodeURIComponent(server.accessToken)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!local.ok) throw new Error(`Server returned ${local.status}`)
  const guid: string | undefined = (await local.json()).MediaContainer?.Metadata?.[0]?.guid
  if (!guid?.startsWith('plex://movie/')) throw new Error('No Plex ID for this movie')

  const remote = await fetch(
    `https://metadata.provider.plex.tv/library/metadata/${guid.split('/').pop()}?X-Plex-Token=${encodeURIComponent(authToken)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!remote.ok) throw new Error(`Plex metadata returned ${remote.status}`)
  const slug: string | undefined = (await remote.json()).MediaContainer?.Metadata?.[0]?.slug
  if (!slug) throw new Error('No slug for this movie')
  slugCache.set(ratingKey, slug)
  return slug
}

export async function openInPlex(movie: Movie): Promise<void> {
  if (!movie.ratingKey) throw new Error('Missing ratingKey')
  const url = `https://watch.plex.tv/movie/${await lookupSlug(movie.ratingKey)}`
  if (Capacitor.isNativePlatform()) await AppLauncher.openUrl({ url })
  else window.open(url, '_blank', 'noopener')
}
