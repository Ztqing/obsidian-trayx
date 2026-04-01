import * as assert from "node:assert/strict";
import { test } from "node:test";

import type { AvailableDesktopRuntime } from "../src/runtime/electron";
import { WindowManager } from "../src/window-manager";
import { FakeApp, FakeEventEmitter, FakeWindow } from "./helpers/fakes";

class FakeTray extends FakeEventEmitter {
	destroy(): void {}
	popUpContextMenu(): void {}
	setToolTip(): void {}
}

function createRuntime(currentWindow: FakeWindow): AvailableDesktopRuntime {
	const allWindows = [currentWindow];

	return {
		available: true,
		app: new FakeApp(),
		BrowserWindow: {
			getAllWindows: () => allWindows,
		},
		currentWindow,
		diagnostics: {
			bridgeKind: "host.remote",
			capabilitySources: {},
			electronModuleLoaded: true,
			failureReason: "ok",
			missingCapabilities: [],
			notes: [],
			platform: "darwin",
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
		platform: "darwin",
		Tray: FakeTray,
	};
}

void test("WindowManager tracks the current window once and new popout windows on demand", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);

	windowManager.start();
	windowManager.start();

	assert.deepEqual(
		windowManager.getWindows().map((window) => window.id),
		[1],
	);

	const popout = new FakeWindow(2);
	currentWindow.webContents.emit("did-create-window", popout);

	assert.deepEqual(
		windowManager.getWindows().map((window) => window.id),
		[1, 2],
	);
});

void test("WindowManager applies skipTaskbar to tracked and newly tracked windows", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);

	windowManager.start();
	windowManager.setSkipTaskbar(true);

	const popout = new FakeWindow(2);
	currentWindow.webContents.emit("did-create-window", popout);

	assert.deepEqual(currentWindow.skipTaskbarStates, [false, true]);
	assert.deepEqual(popout.skipTaskbarStates, [true]);
});

void test("WindowManager restores minimized and remembered maximized windows before focusing", () => {
	const currentWindow = new FakeWindow(1);
	currentWindow.setMinimized(true);
	currentWindow.setMaximized(true);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);

	windowManager.start();
	currentWindow.emit("maximize");

	windowManager.showWindows();

	assert.equal(currentWindow.restoreCount, 1);
	assert.equal(currentWindow.showCount, 1);
	assert.equal(currentWindow.maximizeCount, 1);
	assert.equal(currentWindow.focusCount, 1);
});

void test("WindowManager hides or minimizes windows based on background mode", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);

	windowManager.start();
	windowManager.hideWindows(false);
	windowManager.hideWindows(true);

	assert.equal(currentWindow.minimizeCount, 1);
	assert.equal(currentWindow.hideCount, 1);
});

void test("WindowManager reports dock restore when windows exist but none are visible", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);

	windowManager.start();
	assert.equal(windowManager.needsDockRestore(), false);

	currentWindow.setVisible(false);
	assert.equal(windowManager.needsDockRestore(), true);
});

void test("WindowManager destroy removes listeners and clears tracked windows", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);

	windowManager.start();
	windowManager.destroy();

	const popout = new FakeWindow(2);
	currentWindow.webContents.emit("did-create-window", popout);

	assert.deepEqual(windowManager.getWindows(), []);
	assert.equal(currentWindow.webContents.listenerCount("did-create-window"), 0);
});

void test("WindowManager filters destroyed tracked windows out of its public window list", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);
	const popout = new FakeWindow(2);

	windowManager.start();
	currentWindow.webContents.emit("did-create-window", popout);
	popout.destroy();

	assert.deepEqual(
		windowManager.getWindows().map((window) => window.id),
		[1],
	);
});

void test("WindowManager only forwards focus callbacks from tracked windows", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);
	let focusCalls = 0;

	windowManager.start({
		onFocus: () => {
			focusCalls += 1;
		},
	});

	currentWindow.focus();

	const unmanagedWindow = new FakeWindow(99);
	unmanagedWindow.focus();

	assert.equal(focusCalls, 1);
});

void test("WindowManager reports topology changes when tracked windows are created and closed", () => {
	const currentWindow = new FakeWindow(1);
	const runtime = createRuntime(currentWindow);
	const windowManager = new WindowManager(runtime);
	let topologyCalls = 0;

	windowManager.start({
		onTopologyChange: () => {
			topologyCalls += 1;
		},
	});

	const popout = new FakeWindow(2);
	currentWindow.webContents.emit("did-create-window", popout);
	assert.equal(topologyCalls, 1);

	popout.destroy();
	assert.equal(topologyCalls, 2);
});
