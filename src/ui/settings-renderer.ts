import type { SettingDefinition } from "../i18n";
import type { TrayXSettings } from "../settings";

export interface ToggleControlLike {
	onChange(callback: (value: boolean) => Promise<void> | void): this;
	setValue(value: boolean): this;
}

export interface SettingControlLike {
	addToggle(configure: (toggle: ToggleControlLike) => void): this;
	setDesc(description: string): this;
	setName(name: string): this;
}

export interface SettingsContainerLike {
	empty(): void;
}

export interface SettingsRenderOptions<ContainerEl extends SettingsContainerLike> {
	containerEl: ContainerEl;
	createSetting(containerEl: ContainerEl): SettingControlLike;
	definitions: SettingDefinition[];
	settings: TrayXSettings;
	updateSetting<Key extends keyof TrayXSettings>(
		key: Key,
		value: TrayXSettings[Key],
	): Promise<void> | void;
}

export function renderTrayXSettings<ContainerEl extends SettingsContainerLike>(
	options: SettingsRenderOptions<ContainerEl>,
): void {
	const { containerEl } = options;
	containerEl.empty();

	for (const definition of options.definitions) {
		options
			.createSetting(containerEl)
			.setName(definition.name)
			.setDesc(definition.description)
			.addToggle((toggle) => {
				toggle.setValue(options.settings[definition.key]).onChange(async (value) => {
					await options.updateSetting(definition.key, value);
				});
			});
	}
}
