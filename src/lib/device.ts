// Google/Android TV builds report e.g. "Android 14; Google TV Streamer" in the
// WebView user agent and have no touchscreen. Desktop browsers and tablets
// don't match either check.
export const isTv =
  /Android TV|Google TV|\bTV\b|AFT[A-Z]|BRAVIA|SmartTV/i.test(navigator.userAgent) ||
  (/Android/i.test(navigator.userAgent) && navigator.maxTouchPoints === 0)
