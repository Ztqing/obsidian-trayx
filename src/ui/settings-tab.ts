import { App, Platform, PluginSettingTab, Setting } from "obsidian";

import { getSettingDefinitions } from "../i18n";
import type TrayXPlugin from "../main";
import { renderTrayXSettings } from "./settings-renderer";

export class TrayXSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: TrayXPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		renderTrayXSettings({
			containerEl: this.containerEl,
			createSetting: (containerEl) => new Setting(containerEl),
			definitions: getSettingDefinitions({ isMacOS: Platform.isMacOS }),
			settings: this.plugin.settings,
			updateSetting: (key, value) => this.plugin.updateSetting(key, value),
		});
	}
}
