import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
	formatRuntimeFailureReason,
	getCurrentLocale,
	getLocalizedStrings,
	getRuntimeFailureReason,
	getSettingDefinitions,
	getTrayCreationFailureNotice,
	resolveLocale,
} from "../src/i18n";

void test("resolveLocale maps all zh variants to zh and falls back to en otherwise", () => {
	assert.equal(resolveLocale("zh"), "zh");
	assert.equal(resolveLocale("zh-CN"), "zh");
	assert.equal(resolveLocale("zh-TW"), "zh");
	assert.equal(resolveLocale("en"), "en");
	assert.equal(resolveLocale("ja"), "en");
	assert.equal(resolveLocale(undefined), "en");
});

void test("getSettingDefinitions returns localized settings for macOS and Windows", () => {
	assert.deepEqual(
		getSettingDefinitions({ isMacOS: true, locale: "en" }),
		[
			{
				description: "Show a system tray or menu bar icon for this vault.",
				key: "enableTrayIcon",
				name: "Enable tray icon",
			},
			{
				description: "Hide the window instead of closing it when you close the app window.",
				key: "runInBackground",
				name: "Run in background",
			},
			{
				description:
					"Hide or minimize the window after startup, based on the current background behavior.",
				key: "hideOnLaunch",
				name: "Hide on launch",
			},
			{
				description: "Open the app automatically when you sign in on this device.",
				key: "launchOnStartup",
				name: "Launch on startup",
			},
			{
				description:
					"Hide the app from the dock while TrayX is active. This affects the whole app, not just this vault.",
				key: "hideAppIcon",
				name: "Hide app icon",
			},
		],
	);

	assert.deepEqual(
		getSettingDefinitions({ isMacOS: false, locale: "zh" }),
		[
			{
				description: "为当前库显示系统托盘或菜单栏图标。",
				key: "enableTrayIcon",
				name: "启用托盘图标",
			},
			{
				description: "关闭应用窗口时隐藏窗口，而不是直接关闭它。",
				key: "runInBackground",
				name: "后台运行",
			},
			{
				description: "启动后根据当前后台运行行为隐藏或最小化窗口。",
				key: "hideOnLaunch",
				name: "启动时隐藏",
			},
			{
				description: "在此设备登录时自动打开应用。",
				key: "launchOnStartup",
				name: "登录时启动",
			},
			{
				description: "TrayX 运行期间将窗口从任务栏中隐藏。启用此项时请保持托盘图标开启。",
				key: "hideAppIcon",
				name: "隐藏应用图标",
			},
		],
	);
});

void test("formatRuntimeFailureReason localizes runtime bridge failures", () => {
	assert.equal(
		formatRuntimeFailureReason(
			{
				key: "bridge-disabled",
				bridgeKind: "@electron/remote",
				missingCapabilities: ["Menu", "Tray"],
			},
			"en",
		),
		"TrayX found @electron/remote, but it is disabled for this plugin WebContents. Missing capabilities: Menu, Tray.",
	);

	assert.equal(
		formatRuntimeFailureReason(
			{
				key: "bridge-disabled",
				bridgeKind: "@electron/remote",
				missingCapabilities: ["Menu", "Tray"],
			},
			"zh",
		),
		"TrayX 找到了 @electron/remote，但它已对这个插件的 WebContents 禁用。缺失能力: Menu, Tray。",
	);
});

void test("localized string catalogs keep the same key shape across locales", () => {
	assert.deepEqual(
		getValueShape(getLocalizedStrings("en")),
		getValueShape(getLocalizedStrings("zh")),
	);
});

void test("getCurrentLocale resolves the configured language through the injected reader", () => {
	assert.equal(getCurrentLocale(() => "zh-CN"), "zh");
	assert.equal(getCurrentLocale(() => "ja"), "en");
	assert.equal(getCurrentLocale(() => undefined), "en");
});

void test("runtime failure helpers prefer descriptors and otherwise preserve the raw failure string", () => {
	assert.equal(
		getRuntimeFailureReason(
			{
				failureReason: "raw fallback",
				failureReasonDescriptor: {
					bridgeKind: "host.remote",
					key: "using-bridge",
				},
			},
			"en",
		),
		"TrayX is using host.remote.",
	);

	assert.equal(
		getRuntimeFailureReason(
			{
				failureReason: "raw fallback",
			},
			"zh",
		),
		"raw fallback",
	);
});

void test("getTrayCreationFailureNotice stays localized for both supported locales", () => {
	assert.equal(
		getTrayCreationFailureNotice("en"),
		"Could not create the tray icon in this desktop build.",
	);
	assert.equal(
		getTrayCreationFailureNotice("zh"),
		"无法在当前桌面版中创建托盘图标。",
	);
});

function getValueShape(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => getValueShape(item));
	}

	if (typeof value === "function") {
		return "function";
	}

	if (typeof value !== "object" || value === null) {
		return typeof value;
	}

	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, nestedValue]) => [key, getValueShape(nestedValue)]),
	);
}
