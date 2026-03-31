import * as assert from "node:assert/strict";
import { test } from "node:test";

import type { AvailableDesktopRuntime } from "../src/runtime/electron";
import {
	AppLifecycleController,
	buildLoginItemSettings,
} from "../src/lifecycle/app-lifecycle";
import { FakeApp, FakeWindow } from "./helpers/fakes";

function createRuntime(platform: AvailableDesktopRuntime["platform"]) {
	return {
		available: true,
		app: new FakeApp(),
		BrowserWindow: {
			getAllWindows: () => [],
		},
		currentWindow: new FakeWindow(1),
		diagnostics: {
			bridgeKind: "host.remote",
			capabilitySources: {},
			electronModuleLoaded: true,
			failureReason: "ok",
			missingCapabilities: [],
			notes: [],
			platform,
		},
		Menu: {
			buildFromTemplate: () => ({}),
		},
		nativeImage: {
			createFromDataURL: () => ({
				resize: () => ({
					resize: () => {
						throw new Error("not used");
					},
					setTemplateImage: () => {},
				}),
				setTemplateImage: () => {},
			}),
			createFromPath: () => ({
				resize: () => ({
					resize: () => {
						throw new Error("not used");
					},
					setTemplateImage: () => {},
				}),
				setTemplateImage: () => {},
			}),
		},
		platform,
		Tray: class {
			destroy(): void {}
			on(): void {}
			popUpContextMenu(): void {}
			removeListener(): void {}
			setToolTip(): void {}
		},
	} satisfies AvailableDesktopRuntime;
}

void test("AppLifecycleController applies dock and taskbar visibility safely", () => {
	const windowManager = {
		needsDockRestore: () => false,
		setSkipTaskbarCalls: [] as boolean[],
		setSkipTaskbar(skipTaskbar: boolean): void {
			this.setSkipTaskbarCalls.push(skipTaskbar);
		},
	};
	const runtime = createRuntime("darwin");
	const controller = new AppLifecycleController(runtime, windowManager, {
		onActivateRestore(): void {},
		onBeforeQuit(): void {},
	});

	controller.applySettings({
		canHideAppIconSafely: true,
		hideAppIcon: true,
		hideOnLaunch: true,
		launchOnStartup: true,
		runInBackground: true,
	});

	assert.equal(controller.getAppIconHidden(), true);
	assert.deepEqual(windowManager.setSkipTaskbarCalls, [true]);
	assert.equal(runtime.app.dockHideCount, 1);
	assert.deepEqual(runtime.app.loginItemSettingsCalls, [
		{ openAtLogin: true, openAsHidden: true },
	]);

	controller.applySettings({
		canHideAppIconSafely: false,
		hideAppIcon: true,
		hideOnLaunch: true,
		launchOnStartup: true,
		runInBackground: false,
	});

	assert.equal(controller.getAppIconHidden(), false);
	assert.deepEqual(windowManager.setSkipTaskbarCalls, [true, false]);
	assert.equal(runtime.app.dockShowCount, 1);
	assert.deepEqual(runtime.app.loginItemSettingsCalls[1], {
		openAtLogin: true,
		openAsHidden: false,
	});
});

void test("AppLifecycleController syncVisibilityAndRestorePath keeps activate listeners aligned", () => {
	const windowManager = {
		needsDockRestore: () => true,
		setSkipTaskbar(): void {},
	};
	const runtime = createRuntime("darwin");
	const controller = new AppLifecycleController(runtime, windowManager, {
		onActivateRestore(): void {},
		onBeforeQuit(): void {},
	});

	controller.initialize();
	assert.equal(runtime.app.listenerCount("activate"), 0);

	controller.syncVisibilityAndRestorePath(true, true);
	assert.equal(controller.getAppIconHidden(), true);
	assert.equal(runtime.app.listenerCount("activate"), 0);

	controller.syncVisibilityAndRestorePath(true, false);
	assert.equal(controller.getAppIconHidden(), false);
	assert.equal(runtime.app.listenerCount("activate"), 1);

	controller.syncVisibilityAndRestorePath(true, true);
	assert.equal(controller.getAppIconHidden(), true);
	assert.equal(runtime.app.listenerCount("activate"), 0);

	controller.destroy();
	assert.equal(runtime.app.listenerCount("activate"), 0);
});

void test("AppLifecycleController registers activate and before-quit handlers", () => {
	const windowManager = {
		needsDockRestore: () => true,
		setSkipTaskbar(): void {},
	};
	const runtime = createRuntime("darwin");
	const calls: string[] = [];
	const controller = new AppLifecycleController(runtime, windowManager, {
		onActivateRestore(): void {
			calls.push("activate");
		},
		onBeforeQuit(): void {
			calls.push("before-quit");
		},
	});

	controller.initialize();
	controller.applySettings({
		canHideAppIconSafely: false,
		hideAppIcon: false,
		hideOnLaunch: false,
		launchOnStartup: false,
		runInBackground: true,
	});

	runtime.app.emit("activate");
	runtime.app.emit("before-quit");

	assert.deepEqual(calls, ["activate", "before-quit"]);

	controller.destroy();
	assert.equal(runtime.app.listenerCount("activate"), 0);
	assert.equal(runtime.app.listenerCount("before-quit"), 0);
});

void test("buildLoginItemSettings maps launch, hide, and background flags consistently", () => {
	assert.deepEqual(
		buildLoginItemSettings({
			canHideAppIconSafely: true,
			hideAppIcon: true,
			hideOnLaunch: true,
			launchOnStartup: true,
			runInBackground: true,
		}),
		{
			openAtLogin: true,
			openAsHidden: true,
		},
	);

	assert.deepEqual(
		buildLoginItemSettings({
			canHideAppIconSafely: false,
			hideAppIcon: false,
			hideOnLaunch: true,
			launchOnStartup: true,
			runInBackground: false,
		}),
		{
			openAtLogin: true,
			openAsHidden: false,
		},
	);
});
