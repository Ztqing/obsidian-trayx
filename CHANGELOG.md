# Changelog

All notable user-facing changes for this plugin are documented in this file.

## [1.0.0]

### Added

- Desktop tray integration on Windows and menu bar integration on macOS for the current vault.
- Commands for toggling, showing, hiding, relaunching, closing the current vault, and showing runtime diagnostics.
- Settings for tray icon visibility, background running, hide on launch, launch on startup, and hiding the app icon while TrayX is active.
- Runtime diagnostics covering bridge choice, capability sources, tray readiness, tray owner, restore path, close interception state, tray icon path and health, and tray bounds.
- English and Simplified Chinese runtime localization that follows Obsidian's default language, mapping all `zh*` locales to Simplified Chinese.
- Release artifacts for `main.js`, `manifest.json`, `styles.css`, `trayTemplate.png`, and `trayTemplate@2x.png`.

### Changed

- Release positioning is explicitly desktop-only and keeps `manifest.json` set to `isDesktopOnly: true`.
- Repository documentation is organized around English README, Chinese README, and a dedicated changelog entry point.

### Security / Reliability

- Tray ownership is synchronized so a single live window owns the tray for the same vault at a time.
- Restore-path checks prevent users from getting stuck in an unrecoverable background-close state when tray or Dock restore is unavailable.
- macOS tray icon diagnostics continue to expose icon path, existence, emptiness, template status, and bounds for troubleshooting.
- The plugin release boundary remains local-only, with no network requests, telemetry, or remote code execution.
