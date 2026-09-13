// Arrow-key/D-pad focus navigation. A TV remote has no pointer, and relying on
// the WebView's built-in spatial-navigation heuristics proved unreliable across
// our CSS grid layouts (confirmed on-device: a D-pad press from the sign-in
// button failed to reach "Connect manually instead" below it). This instead
// moves focus linearly through the DOM's focusable elements, which is 100%
// predictable regardless of layout — and works identically with a real
// keyboard, so it's testable on desktop before ever touching a TV.
//
// Enter/Space activating the focused element is native <button>/<a> browser
// behavior already — nothing extra needed for that.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

const FORWARD_KEYS = new Set(['ArrowDown', 'ArrowRight'])
const BACKWARD_KEYS = new Set(['ArrowUp', 'ArrowLeft'])

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  const style = getComputedStyle(el)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

function getFocusable(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible)
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

// Let native behavior win where arrow keys already mean something on the
// currently focused control (cursor movement in text fields, option cycling
// in <select>), rather than hijacking them for focus navigation.
function nativeArrowBehaviorApplies(active: HTMLElement, key: string): boolean {
  if (active.tagName === 'SELECT' || active.tagName === 'TEXTAREA') return true
  if (active.tagName === 'INPUT') {
    const type = (active as HTMLInputElement).type
    if (TEXT_INPUT_TYPES.has(type) && (key === 'ArrowLeft' || key === 'ArrowRight')) return true
  }
  return false
}

function handleKeydown(event: KeyboardEvent) {
  if (!FORWARD_KEYS.has(event.key) && !BACKWARD_KEYS.has(event.key)) return

  const active = document.activeElement as HTMLElement | null
  if (active && nativeArrowBehaviorApplies(active, event.key)) return

  const focusable = getFocusable()
  if (!focusable.length) return
  const currentIndex = active ? focusable.indexOf(active) : -1

  const nextIndex = FORWARD_KEYS.has(event.key)
    ? currentIndex < 0
      ? 0
      : Math.min(currentIndex + 1, focusable.length - 1)
    : currentIndex < 0
      ? 0
      : Math.max(currentIndex - 1, 0)

  if (nextIndex === currentIndex) return

  event.preventDefault()
  const next = focusable[nextIndex]
  // Some WebView builds won't move DOM focus away from a <summary> (or
  // possibly other elements) on a bare .focus() call to a different element —
  // confirmed on-device that an explicit .blur() first reliably releases it.
  active?.blur()
  next.focus()
  next.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function installDpadNavigation(): () => void {
  window.addEventListener('keydown', handleKeydown)
  return () => window.removeEventListener('keydown', handleKeydown)
}
