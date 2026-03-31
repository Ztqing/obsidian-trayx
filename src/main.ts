import { Plugin } from "obsidian";
import * as path from "path";

import { registerCommands } from "./commands";
import { DEFAULT_SETTINGS, type TrayXSettings, loadTrayXSettings } from "./settings";
import { TrayController } from "./tray-controller";
import { TrayXSettingTab } from "./ui/settings-tab";

export default class TrayXPlugin extends Plugin {
	settings: TrayXSettings = DEFAULT_SETTINGS;
	private trayController: TrayController | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.trayController = new TrayController(this.app, this.settings, this.getPluginDir());
		this.trayController.initialize();

		this.addSettingTab(new TrayXSettingTab(this.app, this));
		registerCommands(this);

		if (this.settings.hideOnLaunch) {
			this.app.workspace.onLayoutReady(() => {
				window.setTimeout(() => this.trayController?.handleHideOnLaunch(), 0);
			});
		}
	}

	onunload(): void {
		this.trayController?.unload();
		this.trayController = null;
	}

	async updateSetting<Key extends keyof TrayXSettings>(
		key: Key,
		value: TrayXSettings[Key],
	): Promise<void> {
		this.settings[key] = value;
		await this.saveSettings();
		this.trayController?.applySettings(this.settings);
	}

	toggleVaultVisibility(): void {
		this.trayController?.toggleVaultVisibility();
	}

	showVault(): void {
		this.trayController?.showVault();
	}

	hideVault(): void {
		this.trayController?.hideVault();
	}

	relaunchApp(): void {
		this.trayController?.relaunchApp();
	}

	closeVault(): void {
		this.trayController?.closeVault();
	}

	showRuntimeDiagnostics(): void {
		this.trayController?.showRuntimeDiagnostics();
	}

	private async loadSettings(): Promise<void> {
		this.settings = loadTrayXSettings(await this.loadData());
	}

	private async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private getPluginDir(): string {
		const manifestDir = this.manifest.dir;
		if (manifestDir && path.isAbsolute(manifestDir)) {
			return manifestDir;
		}

		const adapter = this.app.vault.adapter as {
			getBasePath?: () => string;
		};
		const basePath = typeof adapter.getBasePath === "function" ? adapter.getBasePath() : null;
		if (!basePath) {
			return manifestDir ?? ".";
		}

		if (manifestDir) {
			return path.join(basePath, manifestDir);
		}

		return path.join(basePath, this.app.vault.configDir, "plugins", this.manifest.id);
	}
}
