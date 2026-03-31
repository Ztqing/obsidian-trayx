import * as assert from "node:assert/strict";
import { test } from "node:test";

import { getSettingDefinitions } from "../src/i18n";
import { DEFAULT_SETTINGS } from "../src/settings";
import { renderTrayXSettings } from "../src/ui/settings-renderer";
import {
	FakeSettingFactory,
	FakeSettingsContainer,
	FakeSettingsPlugin,
} from "./helpers/fakes";

void test("renderTrayXSettings clears the container and preserves setting order", () => {
	const container = new FakeSettingsContainer();
	const factory = new FakeSettingFactory();
	const plugin = new FakeSettingsPlugin({ ...DEFAULT_SETTINGS });

	renderTrayXSettings({
		containerEl: container,
		createSetting: (containerEl) => factory.createSetting(containerEl),
		definitions: getSettingDefinitions({ isMacOS: false, locale: "zh" }),
		settings: plugin.settings,
		updateSetting: (key, value) => plugin.updateSetting(key, value),
	});

	assert.equal(container.emptyCalls, 1);
	assert.deepEqual(
		factory.controls.map((control) => ({
			description: control.description,
			name: control.name,
		})),
		getSettingDefinitions({ isMacOS: false, locale: "zh" }).map((definition) => ({
			description: definition.description,
			name: definition.name,
		})),
	);
});

void test("renderTrayXSettings initializes toggle state from plugin settings and forwards updates", async () => {
	const container = new FakeSettingsContainer();
	const factory = new FakeSettingFactory();
	const plugin = new FakeSettingsPlugin({
		...DEFAULT_SETTINGS,
		enableTrayIcon: false,
		hideAppIcon: true,
		hideOnLaunch: true,
	});

	renderTrayXSettings({
		containerEl: container,
		createSetting: (containerEl) => factory.createSetting(containerEl),
		definitions: getSettingDefinitions({ isMacOS: true, locale: "en" }),
		settings: plugin.settings,
		updateSetting: (key, value) => plugin.updateSetting(key, value),
	});

	assert.deepEqual(
		factory.controls.map((control) => control.toggle.value),
		[
			plugin.settings.enableTrayIcon,
			plugin.settings.runInBackground,
			plugin.settings.hideOnLaunch,
			plugin.settings.launchOnStartup,
			plugin.settings.hideAppIcon,
		],
	);

	await factory.controls[0]?.toggle.trigger(true);
	await factory.controls[4]?.toggle.trigger(false);

	assert.deepEqual(plugin.updates, [
		{ key: "enableTrayIcon", value: true },
		{ key: "hideAppIcon", value: false },
	]);
});
