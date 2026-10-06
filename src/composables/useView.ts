import { ref } from 'vue'

export type View = 'home' | 'pick' | 'stats' | 'sync'

const view = ref<View>('home')

// Each non-home view is a history entry, so the TV remote's Back button (which
// the Android WebView maps to history.back()) returns home instead of exiting.
function goTo(next: View) {
  if (next === view.value) return
  if (next === 'home') {
    if (history.state?.view) history.back()
    else view.value = 'home'
    return
  }
  history.pushState({ view: next }, '')
  view.value = next
  window.scrollTo(0, 0)
}

window.addEventListener('popstate', () => {
  view.value = (history.state?.view as View | undefined) ?? 'home'
  window.scrollTo(0, 0)
})

export function useView() {
  return { view, goTo }
}
