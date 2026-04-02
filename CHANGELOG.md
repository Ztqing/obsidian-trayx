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

- Hide-on-launch now follows the actual runtime mode: it minimizes in foreground-only mode and hides only when background recovery is available.
- Runtime diagnostics now expose the latest tray refresh error and restore blocker so degraded restore behavior is easier to explain.
- Tray controller reconciliation now reruns when tracked window topology changes, helping the current window reclaim tray ownership after a stale owner disappears.
- Release readiness now pins the Obsidian dependency to `1.10.3`, adds a `release:check` gate, and aligns CI with the documented `test:unit` / `lint` / `build` flow.
- Release positioning is explicitly desktop-only and keeps `manifest.json` set to `isDesktopOnly: true`.
- Repository documentation is organized around English README, Chinese README, and a dedicated changelog entry point.
- Repository history now excludes generated `main.js` bundles and local `AGENTS.md` guidance; release builds should regenerate `main.js` locally or in CI before packaging.

### Security / Reliability

- Recovery hardening keeps tray ownership, restore-path decisions, and close interception aligned after tray refresh failures and later retries.
- Runtime bridge probing now validates `nativeImage` and `currentWindow` against the real tray and window-management call paths, and bridge diagnostics keep disabled and unavailable states more consistent.
- Tray refreshes now reuse the existing tray when the owner, locale, tooltip, and asset state have not changed, reducing duplicate tray rebuilds across repeated restore cycles.
- Tray ownership is synchronized so a single live window owns the tray for the same vault at a time.
- Restore-path checks prevent users from getting stuck in an unrecoverable background-close state when tray or Dock restore is unavailable.
- macOS tray icon diagnostics continue to expose icon path, existence, emptiness, template status, and bounds for troubleshooting.
- The plugin release boundary remains local-only, with no network requests, telemetry, or remote code execution.
