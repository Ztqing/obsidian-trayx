import * as assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SETTINGS, loadTrayXSettings } from "../src/settings";
import { SETTING_ORDER } from "../src/ui-metadata";

void test("loadTrayXSettings returns defaults for missing or invalid records", () => {
	assert.deepEqual(loadTrayXSettings(undefined), DEFAULT_SETTINGS);
	assert.deepEqual(loadTrayXSettings(null), DEFAULT_SETTINGS);
	assert.deepEqual(loadTrayXSettings("trayx"), DEFAULT_SETTINGS);
	assert.deepEqual(
		loadTrayXSettings({
			enableTrayIcon: "yes",
			runInBackground: 1,
			hideOnLaunch: [],
			launchOnStartup: {},
			hideAppIcon: "no",
		}),
		DEFAULT_SETTINGS,
	);
});

void test("loadTrayXSettings preserves explicit boolean values", () => {
	assert.deepEqual(
		loadTrayXSettings({
			enableTrayIcon: false,
			runInBackground: false,
			hideOnLaunch: true,
			launchOnStartup: true,
			hideAppIcon: true,
		}),
		{
			enableTrayIcon: false,
			runInBackground: false,
			hideOnLaunch: true,
			launchOnStartup: true,
			hideAppIcon: true,
		},
	);
});

void test("SETTING_ORDER stays in sync with the persisted settings keys", () => {
	assert.deepEqual(
		[...SETTING_ORDER].sort(),
		Object.keys(DEFAULT_SETTINGS).sort(),
	);
});
