<!-- markdownlint-disable MD037 MD022 MD032 MD024 -->

# CHANGELOG

## [1.3.1] - 2026-10-16

### Added

- Shuffle button on the picker, to reorder the current picks without changing them

### Fixed

- Android back button closing the app instead of going back to home

## [1.3.0] - 2026-10-16

### Added

- Library re-indexes in the background to pick up new movies and watched status

### Changed

- Talks to Plex directly from the app, no server needed
- Library cache moved to IndexedDB, so large libraries fit
- New app icon and package ID

## [1.2.0] - 2026-10-06

### Added

- Sync a Letterboxd list to a Plex collection

## [1.1.1] - 2026-09-20

### Added

- Tablet and portrait layouts
- "This year" and "Last year" picker filters

### Changed

- Slot spin animation turned off, as it lagged on the tablet

## [1.1.0] - 2026-09-18

### Added

- Home menu with separate Pick and Stats pages
- Account menu with library refresh and sign out
- Open a picked movie in Plex
- Collection filter on the picker

### Changed

- Redesigned library stats

## [1.0.1] - 2026-09-17

### Added

- Hold button to keep a pick while re-rolling the rest

### Changed

- Finer duration buckets in stats

## [1.0.0] - 2026-09-12

### Added

- Plex sign-in and server picker
- Random movie picker with slot-machine reels
- Picker filters for genre, decade, country, duration and watched status
- Library stats
- Android app with TV remote (D-pad) navigation
