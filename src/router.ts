import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { createRouter, createWebHistory } from 'vue-router'
import HomeMenu from './components/HomeMenu.vue'
import RandomPicker from './components/RandomPicker.vue'
import LibraryAnalytics from './components/LibraryAnalytics.vue'
import ListSync from './components/ListSync.vue'
import PlexDebug from './components/PlexDebug.vue'

// Every screen has a URL, so a reload (or the app being restored) lands back on
// it. Android's Back button is wired up at the bottom of this file. Signed-out
// and server-picking states aren't routes — App.vue shows those over whatever
// route is current.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeMenu },
    { path: '/pick', name: 'pick', component: RandomPicker },
    { path: '/stats', name: 'stats', component: LibraryAnalytics },
    { path: '/sync', name: 'sync', component: ListSync },
    // Hidden: not linked from the menu — open it by URL.
    { path: '/debug', name: 'debug', component: PlexDebug },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

/** Back to the previous screen, or home when this page was opened directly. */
export function goHome() {
  if (router.currentRoute.value.name === 'home') return
  if (router.options.history.state.back) router.back()
  else router.replace('/')
}

// Android's Back button (phone, tablet and the TV remote). Capacitor doesn't
// pass it to the WebView by itself (without this the app just closes), so route
// it through the router: back through history, else home, and from home
// background the app like other Android apps do.
if (Capacitor.isNativePlatform()) {
  App.addListener('backButton', () => {
    if (router.options.history.state.back) router.back()
    else if (router.currentRoute.value.name !== 'home') router.replace('/')
    else App.minimizeApp()
  })
}
