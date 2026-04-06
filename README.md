<div align="center">
  <h1>TrayX</h1>
  <p><strong>A desktop-first Obsidian plugin for keeping the current vault available from the system tray or menu bar.</strong></p>
  <p>English | <a href="README_ZH.md">中文</a> | <a href="CHANGELOG.md">Changelog</a></p>
</div>

## What it does

- Keeps the current desktop vault available from a tray icon on Windows and a menu bar icon on macOS.
- Shows, hides, and toggles vault visibility from the tray or command palette.
- Keeps the vault running in the background instead of closing the main window when background mode is enabled.
- Supports hide-on-launch, launch-on-startup, and optional app icon hiding while TrayX is active.
- Exposes runtime diagnostics for bridge choice, tray readiness, tray ownership, restore path, icon health, and close interception state.
- Stays local-only and does not add network requests, telemetry, or remote code execution.
- Follows the Obsidian interface language at runtime:
  - Simplified Chinese for all `zh*` language codes
  - English for every other language

## Project status

TrayX already covers the core desktop tray workflow for hiding, restoring, and diagnosing the current vault. The current release target is the initial `1.0.0` GitHub release, with scope intentionally centered on desktop stability, observability, and predictable recovery paths.

The checklist below marks what is already in place and what we expect to keep refining next.

- [x] Desktop-only tray integration for the current vault on Windows and menu bar integration on macOS.
- [x] Commands for toggling, showing, hiding, relaunching, closing, and inspecting the current vault runtime.
- [x] Settings for tray visibility, background mode, hide on launch, launch on startup, and hiding the app icon.
- [x] Tray owner coordination so only one live window owns the tray for the same vault at a time.
- [x] Runtime diagnostics for bridge choice, capability sources, tray state, restore path, close interception, tray path, icon status, and tray bounds.
- [x] English and Simplified Chinese runtime localization for settings, commands, tray menu labels, notices, and diagnostics.
- [x] Fake-based unit coverage for tray lifecycle, restore policy, diagnostics, window visibility, and localization behavior.
- [ ] Continue hardening cross-platform tray and restore behavior through broader manual release validation.
- [ ] Expand diagnostics and observability around repeated close and restore flows and bridge fallback edge cases.
- [ ] Refine tray and menu bar polish, especially around icon clarity and platform-specific interaction details.
- [ ] Keep tightening desktop regression coverage and release guidance as the plugin stabilizes.
- [ ] Revisit any broader platform or feature expansion only after the current desktop scope remains stable.

The roadmap prioritizes desktop stability, observability, and predictable recovery paths.

## Platform and runtime notes

- TrayX is desktop-only because it relies on Electron and Node APIs.
- macOS uses an embedded template menu bar icon generated at runtime, so release builds do not depend on extra tray image files.
- macOS interaction keeps left-click toggle behavior and right-click tray menu behavior.
- Windows uses a generated tray icon and keeps click-to-toggle plus context-menu access.
- Hiding the app icon is app-wide on macOS and affects Dock visibility for the whole Obsidian app, not just one vault.
- Tray ownership is synchronized per vault so only one live window is responsible for the tray at a time.

## Usage

1. Enable TrayX in your desktop vault.
2. Keep **Enable tray icon** turned on if you want tray or menu bar restore access.
3. Use the tray icon, menu bar icon, or command palette to show, hide, or toggle the current vault.
4. Turn on **Run in background** if closing the main window should hide the vault instead of quitting it.
5. Optionally enable **Hide on launch**, **Launch on startup**, or **Hide app icon** depending on how you want Obsidian to behave on your device.
6. If tray behavior looks wrong, run **Show runtime diagnostics** and review the reported bridge, tray readiness, restore path, and icon state.

## Installation

For manual installation or GitHub release builds:

1. Create or open `<vault>/.obsidian/plugins/trayx/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. Reload Obsidian and enable **TrayX** in the community plugins settings for that vault.

## Settings

| Setting | What it does |
| --- | --- |
| Enable tray icon | Show a system tray or menu bar icon for this vault. |
| Run in background | Hide the window instead of closing it when you close the app window. |
| Hide on launch | Minimize the window on startup in foreground mode, or hide it in background mode. |
| Launch on startup | Open the app automatically when you sign in on this device. |
| Hide app icon | Hide the app from the dock on macOS or hide the window from the taskbar on Windows while TrayX is active. |

## Commands

- `Toggle vault visibility`
- `Show vault`
- `Hide vault`
- `Relaunch app`
- `Close vault`
- `Show runtime diagnostics`

TrayX does not register default hotkeys. You can assign your own shortcuts in **Settings → Hotkeys**.

## Diagnostics

`Show runtime diagnostics` is meant to be the first stop when tray behavior does not match expectations. It reports the current desktop runtime state, including:

- bridge choice
- capability sources
- tray readiness
- last tray refresh error
- tray owner
- restore path
- restore blocker
- close interception state
- tray path, when the icon is file-backed
- `trayIconExists`
- `trayIconEmpty`
- `trayIconTemplate`
- tray bounds

This is especially useful when the tray icon does not appear, the vault will not restore, or background hiding is being safely downgraded, because the summary now also explains the latest tray failure and the current blocker behind degraded restore behavior.

## Limitations and recovery boundaries

- This release stays within a desktop-only scope and keeps `manifest.json` set to `isDesktopOnly: true`.
- If no safe restore path is available, TrayX avoids leaving the vault in an unrecoverable background-close state and diagnostics will reflect that degraded mode.
- Command names follow the Obsidian language at plugin load time. If you change the app language, command labels may require reloading TrayX or restarting Obsidian to refresh everywhere.
- The tray menu follows the current language when the tray is rebuilt.
- TrayX manages only the current vault's desktop windows and does not try to coordinate unrelated vaults.
- No network requests, telemetry, or remote code execution are introduced by this plugin.

## Development

```bash
npm ci
npm run dev
```

Useful commands:

- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `npm run release:check`

`main.js` is generated locally or in CI during the build and release flow. The repository tracks the source files and release metadata, but not the generated bundle itself.

## Release artifacts

For manual installation or release builds, copy these files into:

`<vault>/.obsidian/plugins/trayx/`

- `main.js`
- `manifest.json`
- `styles.css`

## Release checklist

Before publishing a release, run:

- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `npm run release:check`

The build should regenerate `main.js` before you package or upload release assets, and `release:check` should confirm that the full release asset set is present while `main.js` still remains untracked in Git.

Then verify in a clean desktop vault:

- the plugin loads without a new runtime notice
- `Show runtime diagnostics` reflects the actual runtime state
- the tray or menu bar icon is visible and interactive
- `Cmd+W` close and restore behavior still works as expected
- `Cmd+Q` and app-menu quit still work correctly
- repeated close and restore cycles do not create duplicate trays
- on macOS, the generated template tray icon is healthy
- on Windows, the tray icon remains legible at small sizes

After that release validation passes:

- create and push the annotated release tag, for example `1.0.0`
- upload the verified release asset set from the clean build output

## Privacy and safety

- TrayX does not make network requests.
- TrayX does not collect telemetry.
- TrayX does not execute remote code.
- TrayX only manages the current desktop vault windows through local Electron APIs.

## Attribution

Special thanks to [dragonwocky/obsidian-tray](https://github.com/dragonwocky/obsidian-tray). TrayX is inspired by and partially adapted from that project, which is released under the MIT License.

## License

MIT
